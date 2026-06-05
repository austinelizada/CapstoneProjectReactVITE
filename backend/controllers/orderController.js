import Order from "../models/Order.js";

const normalizeAddress = (value) => {
  if (!value) return "";
  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,;]+/g, ",")
    .replace(/\s*[.,]\s*/g, ", ")
    .replace(/\s*,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const canonical = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\b(city|province|zip|code|street|st|road|rd)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const normalizedParts = [];
  const seen = [];

  for (const part of parts) {
    const key = canonical(part);
    if (!key) {
      normalizedParts.push(part);
      continue;
    }
    const isDuplicate = seen.some(
      (existing) => existing === key || existing.includes(key) || key.includes(existing)
    );
    if (!isDuplicate) {
      seen.push(key);
      normalizedParts.push(part);
    }
  }

  return normalizedParts.join(", ");
};

const buildAddressFromUser = (user) => {
  if (!user) return "";
  return normalizeAddress(
    [user.street_address, user.city, user.province, user.zip_code].filter(Boolean).join(", ")
  );
};

const sanitizeOrderItems = (items = []) => {
  return (items || []).map((item) => {
    const quantity = Number(item.quantity) || 1;
    const unit_price = Number(item.unit_price) || 0;
    const width = Number(item.width) || 0;
    const height = Number(item.height) || 0;
    const area = Number(item.area) || 0;
    const estimated_price = item.is_estimate
      ? Number(item.estimated_price) || area * unit_price
      : 0;

    return {
      product_id: item.product_id || item._id || null,
      name: item.name,
      quantity,
      unit_price,
      unit: item.unit || "piece",
      width,
      height,
      area,
      estimated_price,
      notes: item.notes || "",
      is_estimate: Boolean(item.is_estimate),
    };
  });
};

const generateTrackingNumber = () => {
  return `ACGC-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;
};

export const listOrders = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role !== "admin") {
      filter.customer = req.user.id;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate("customer", "first_name last_name email phone street_address city province zip_code")
      .populate("items.product_id", "image_url image images name");

    res.json({ success: true, orders });
  } catch (error) {
    console.error("List orders error:", error);
    res.status(500).json({ success: false, message: "Unable to list orders", error: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const { items, shipping_address, order_type } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order items are required" });
    }

    const sanitizedItems = sanitizeOrderItems(items);

    const total_amount = sanitizedItems.reduce((sum, item) => {
      const itemAmount = item.is_estimate && item.estimated_price ? item.estimated_price : item.quantity * item.unit_price;
      return sum + itemAmount;
    }, 0);

    const order = new Order({
      customer: req.user.id,
      items: sanitizedItems,
      total_amount,
      shipping_address: normalizeAddress(shipping_address || buildAddressFromUser(req.user)),
      tracking: generateTrackingNumber(),
      order_type: order_type === "walk_in_customer" ? "walk_in_customer" : "online_order",
      contract_status: "pending",
      payment_status: "not_paid",
      status: "order_submitted",
    });

    await order.save();

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: "Unable to create order", error: error.message });
  }
};

export const createOrderAsAdmin = async (req, res) => {
  try {
    const { items, shipping_address, order_type, attachments, payment_terms, customer_name, customer_phone } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order items are required" });
    }

    const sanitizedItems = sanitizeOrderItems(items);

    const totalAmountFromItems = sanitizedItems.reduce((sum, item) => {
      const itemAmount = item.is_estimate && item.estimated_price ? item.estimated_price : item.quantity * item.unit_price;
      return sum + itemAmount;
    }, 0);

    const overrideAmount = Number(req.body.estimated_cost) || 0;
    const total_amount = overrideAmount > 0 ? overrideAmount : totalAmountFromItems;

    const order = new Order({
      customer: undefined,
      customer_name: customer_name || "",
      customer_phone: customer_phone || "",
      items: sanitizedItems,
      total_amount,
      shipping_address: normalizeAddress(shipping_address || ""),
      payment_terms: payment_terms || "",
      attachments: Array.isArray(attachments) ? attachments : [],
      tracking: generateTrackingNumber(),
      order_type: order_type === "walk_in_customer" ? "walk_in_customer" : "online_order",
      contract_status: "pending",
      payment_status: "not_paid",
      status: "site_inspection",
      inspection_status: "pending",
    });

    await order.save();

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("Create order as admin error:", error);
    res.status(500).json({ success: false, message: "Unable to create order", error: error.message });
  }
};

export const trackOrder = async (req, res) => {
  try {
    const tracking = req.params.tracking?.trim().toUpperCase();
    if (!tracking) {
      return res.status(400).json({ success: false, message: "Tracking number is required" });
    }

    const order = await Order.findOne({ tracking })
      .populate("customer", "first_name last_name email phone street_address city province zip_code")
      .populate("items.product_id", "image_url image images name");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (req.user.role !== "admin" && order.customer._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to view this order" });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Track order error:", error);
    res.status(500).json({ success: false, message: "Unable to track order", error: error.message });
  }
};

export const getAdminOrders = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { status, contract_status } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (contract_status) filter.contract_status = contract_status;

    const orders = await Order.find(filter)
      .populate("items.product_id", "image_url image images name")
      .populate("customer", "first_name last_name email phone street_address")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Get admin orders error:", error);
    res.status(500).json({ success: false, message: "Unable to fetch orders", error: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { status, contract_status, payment_status, inspection_notes, inspection_date } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (status) order.status = status;
    if (contract_status) order.contract_status = contract_status;
    if (payment_status) order.payment_status = payment_status;
    if (inspection_date) order.inspection_date = inspection_date;
    if (inspection_notes) order.inspection_notes = inspection_notes;

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ success: false, message: "Unable to update order", error: error.message });
  }
};

export const updateOrderInspection = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { inspection_status, inspection_date, inspection_notes, issues_found } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (inspection_status) order.inspection_status = inspection_status;
    if (inspection_date) order.inspection_date = inspection_date;
    if (inspection_notes) order.inspection_notes = inspection_notes;
    if (issues_found !== undefined) order.issues_found = issues_found;

    order.status = "site_inspection_scheduled";
    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Update inspection error:", error);
    res.status(500).json({ success: false, message: "Unable to update inspection", error: error.message });
  }
};

export const generateContract = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { contract_terms, contract_amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.contract_status = "generated";
    order.contract_terms = contract_terms || "";
    order.contract_amount = Number(contract_amount) || order.total_amount;
    order.status = "contract_pending_approval";

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Generate contract error:", error);
    res.status(500).json({ success: false, message: "Unable to generate contract", error: error.message });
  }
};

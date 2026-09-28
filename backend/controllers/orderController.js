import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { sendMail } from "../config/mailer.js";

const isWithinReviewEditWindow = (submittedAt) => {
  if (!submittedAt) return false;
  const reviewDate = new Date(submittedAt);
  const editDeadline = new Date(reviewDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return new Date() <= editDeadline;
};

const buildReviewNotificationMessage = (order, review) => {
  const productName = order.items?.[0]?.name || "project";
  return `New customer review received for ${productName} (${order.tracking}).\nRating: ${"⭐".repeat(review.rating || 0)}\nTitle: ${review.title || "-"}\nComment: ${review.comment || "-"}`;
};

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

const getLocalUploadedAttachment = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  try {
    const url = new URL(fileUrl, "http://localhost");
    const pathname = url.pathname || "";
    if (!pathname.startsWith("/uploads/")) return null;
    const filename = pathname.replace(/^\/uploads\//, "");
    if (!filename) return null;
    const filepath = path.join(process.cwd(), "uploads", filename);
    if (!fs.existsSync(filepath)) return null;
    return {
      filename,
      path: filepath,
    };
  } catch (err) {
    return null;
  }
};

const getDataUrlAttachment = (dataUrl, filename) => {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(application\/pdf|image\/png|image\/jpeg)(?:;filename=[^;]+)?;base64,(.+)$/s);
  if (!match) return null;
  return {
    filename,
    content: Buffer.from(match[2], "base64"),
    contentType: match[1],
  };
};

const createContractPdfAttachment = ({
  customerName,
  orderNumber,
  inspectionDate,
  siteAddress,
  paymentTerms,
  warrantyPeriod,
  inspectionNotes,
  totalAmount,
  itemRows,
}) => new Promise((resolve, reject) => {
  const document = new PDFDocument({ margin: 48, size: "A4" });
  const chunks = [];

  document.on("data", (chunk) => chunks.push(chunk));
  document.on("end", () => resolve(Buffer.concat(chunks)));
  document.on("error", reject);

  document.fontSize(18).fillColor("#b91c1c").text("ACGC Glass & Aluminum Services");
  document.moveDown(0.4);
  document.fontSize(14).fillColor("#111827").text("Site Inspection Contract Details");
  document.moveDown();
  document.fontSize(10).fillColor("#111827");
  document.text(`Hi ${customerName},`);
  document.moveDown(0.5);
  document.text("Thank you for choosing ACGC. Below are the contract details based on your site inspection.");
  document.moveDown();
  document.font("Helvetica-Bold").text(`Order Number: ${orderNumber}`);
  document.font("Helvetica").text(`Inspection Date: ${inspectionDate}`);
  document.text(`Site Address: ${siteAddress}`);
  document.text(`Payment Terms: ${paymentTerms}`);
  document.text(`Warranty Period: ${warrantyPeriod}`);
  document.moveDown();

  document.font("Helvetica-Bold").text("Inspection Items");
  document.moveDown(0.4);
  document.font("Helvetica");
  if (itemRows.length === 0) {
    document.text("No measurement items recorded.");
  } else {
    itemRows.forEach((item, index) => {
      document.text(`${index + 1}. ${item.name}`);
      document.text(`   Qty: ${item.quantity} | Dimensions: ${item.dimensions} | Area: ${item.area} | Amount: ${item.amount}`);
      document.moveDown(0.25);
    });
  }

  document.moveDown(0.5);
  document.font("Helvetica-Bold").text(`Total Contract Amount: ${totalAmount}`);
  document.moveDown();
  document.text("Site Notes");
  document.font("Helvetica").text(inspectionNotes, { width: 500 });
  document.moveDown();
  document.text("Please review these details and contact our support team if anything needs to be corrected.");
  document.end();
});

const normalizeProductId = (productId) => {
  if (!productId) return null;
  if (typeof productId === "object") {
    return String(productId._id || productId.id || productId);
  }
  return String(productId);
};

const sanitizeOrderItems = (items = []) => {
  return (items || []).map((item) => {
    const incomingDimensions = item.dimensions || {};
    const quantity = Number(item.quantity ?? incomingDimensions.quantity) || 1;
    const width = Number(incomingDimensions.width ?? item.width) || 0;
    const height = Number(incomingDimensions.height ?? item.height) || 0;
    const measurement_unit = incomingDimensions.unit || item.measurement_unit || item.measurementUnit || "in";
    const area = Number(item.area) || 0;
    const productUnitPrice = Number(item.product_id?.unit_price ?? item.product?.unit_price ?? item.base_price ?? item.price ?? item.unit_price ?? 0) || 0;
    const productRatePerSqft = Number(item.product_id?.price_per_sqft ?? item.product?.price_per_sqft ?? item.price_per_sqft ?? 0) || 0;
    const unit_price = Number(item.unit_price) || productUnitPrice || (productRatePerSqft > 0 && area > 0 ? productRatePerSqft * area : 0);
    const estimated_price = item.is_estimate
      ? Number(item.estimated_price) || Number(item.manual_estimated_total) || area * (productRatePerSqft || unit_price || 0)
      : 0;
    const estimation_mode = item.estimation_mode === "manual" ? "manual" : "auto";
    const manual_estimated_total = Number(item.manual_estimated_total) || 0;
    const customized = Boolean(incomingDimensions.customized ?? item.customized ?? item.is_estimate);

    return {
      product_id: normalizeProductId(item.product_id) || normalizeProductId(item._id) || null,
      name: item.name,
      quantity,
      unit_price,
      unit: item.unit || "piece",
      category: item.category || "",
      product_type: item.product_type || "",
      measurement_unit,
      width,
      height,
      dimensions: {
        width,
        height,
        unit: measurement_unit,
        quantity,
        customized,
      },
      area,
      estimated_price,
      estimation_mode,
      manual_estimated_total,
      notes: item.notes || "",
      customized,
      is_estimate: Boolean(item.is_estimate),
    };
  });
};

const getItemAmountValue = (item) => {
  if (!item) return 0;

  if (item.is_estimate && Number(item.estimated_price || item.manual_estimated_total || 0) > 0) {
    return Number(item.estimated_price || item.manual_estimated_total || 0);
  }

  const quantity = Number(item.quantity || 1) || 1;
  const unitPrice = Number(item.unit_price || 0) || 0;
  const area = Number(item.area || 0) || 0;
  const productRate = Number(item.price_per_sqft || item.product?.price_per_sqft || 0) || 0;

  if (productRate > 0 && area > 0) {
    return productRate * area;
  }

  return unitPrice > 0 ? unitPrice * quantity : 0;
};

const generateTrackingNumber = () => {
  return `TRK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
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
      .populate("items.product_id", "image_url image images name product_name category product_type unit unit_price price_per_sqft price_per_blade");

    res.json({ success: true, orders });
  } catch (error) {
    console.error("List orders error:", error);
    res.status(500).json({ success: false, message: "Unable to list orders", error: error.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const { items, shipping_address, customer_phone, order_type } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order items are required" });
    }

    const sanitizedItems = sanitizeOrderItems(items);
    const hasInvalidDimensions = sanitizedItems.some(
      (item) =>
        Number(item.dimensions?.width) <= 0 ||
        Number(item.dimensions?.height) <= 0 ||
        Number(item.dimensions?.quantity) <= 0 ||
        !item.dimensions?.unit
    );

    if (hasInvalidDimensions) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid product dimensions before submitting your order.",
      });
    }

    const total_amount = sanitizedItems.reduce((sum, item) => sum + getItemAmountValue(item), 0);

    const order = new Order({
      customer: req.user.id,
      customer_phone: String(customer_phone || req.user.phone || "").trim(),
      items: sanitizedItems,
      total_amount,
      shipping_address: normalizeAddress(shipping_address || buildAddressFromUser(req.user)),
      tracking: generateTrackingNumber(),
      order_type: order_type === "walk_in_customer" ? "walk_in_customer" : "online_order",
      contract_status: "pending",
      payment_status: "not_paid",
      status: "site_inspection",
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
    const { 
      items, 
      shipping_address, 
      order_type, 
      attachments, 
      payment_terms,
      agreed_payment_date,
      customer_name, 
      customer_phone, 
      customer_email, 
      customer_id,
      has_account_on_website,
      downpayment_received,
      warranty_period,
      custom_warranty_days,
      // Walk-in customer fields
      signed_contract_url,
      contract_number,
      contract_signed_date,
      inspection_date,
      estimated_installation_date,
      inspection_notes,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order items are required" });
    }

    const normalizedOrderType = order_type === "walk_in_customer" ? "walk_in_customer" : "online_order";
    const isWalkInCustomer = normalizedOrderType === "walk_in_customer";

    if (isWalkInCustomer && !signed_contract_url) {
      return res.status(400).json({ success: false, message: "A signed hard-copy contract is required for walk-in customers" });
    }

    if (customer_id && !mongoose.Types.ObjectId.isValid(customer_id)) {
      return res.status(400).json({ success: false, message: "Customer account ID is invalid" });
    }

    const linkedCustomer = customer_id
      ? await User.findOne({ _id: customer_id, role: "customer" }).select("first_name last_name email phone street_address city province zip_code")
      : null;

    if (customer_id && !linkedCustomer) {
      return res.status(400).json({ success: false, message: "The selected customer account was not found" });
    }

    const sanitizedItems = sanitizeOrderItems(items);

    const totalAmountFromItems = sanitizedItems.reduce((sum, item) => sum + getItemAmountValue(item), 0);

    const overrideAmount = [req.body.manual_override, req.body.estimated_cost, req.body.total_amount, req.body.contract_amount]
      .map(Number)
      .find((amount) => Number.isFinite(amount) && amount > 0) || 0;
    const total_amount = overrideAmount > 0 ? overrideAmount : totalAmountFromItems;

    const hasWebsiteAccount = Boolean(linkedCustomer);
    const walkInSignedAt = contract_signed_date ? new Date(contract_signed_date) : new Date();
    const linkedCustomerName = `${linkedCustomer?.first_name || ""} ${linkedCustomer?.last_name || ""}`.trim();

    const order = new Order({
      customer: linkedCustomer?._id,
      customer_name: linkedCustomerName || customer_name || "",
      customer_phone: linkedCustomer?.phone || customer_phone || "",
      customer_email: linkedCustomer?.email || customer_email || "",
      items: sanitizedItems,
      total_amount,
      manual_override: Number(req.body.manual_override) || 0,
      contract_amount: isWalkInCustomer ? total_amount : 0,
      downpayment_amount: payment_terms === "full_payment" ? total_amount : total_amount * 0.5,
      shipping_address: normalizeAddress(shipping_address || buildAddressFromUser(linkedCustomer)),
      payment_terms: payment_terms || "",
      agreed_payment_date: agreed_payment_date ? new Date(agreed_payment_date) : null,
      has_account_on_website: hasWebsiteAccount,
      downpayment_received: Boolean(downpayment_received),
      warranty_period: warranty_period !== undefined && warranty_period !== null && String(warranty_period).trim() !== ""
        ? String(warranty_period)
        : "90",
      custom_warranty_days: custom_warranty_days !== undefined && custom_warranty_days !== null && Number(custom_warranty_days) > 0
        ? Number(custom_warranty_days)
        : null,
      attachments: Array.isArray(attachments) ? attachments : [],
      tracking: generateTrackingNumber(),
      order_type: normalizedOrderType,
      contract_status: isWalkInCustomer ? "accepted" : "pending",
      payment_status: "not_paid",
      status: isWalkInCustomer ? "contract_accepted" : "site_inspection",
      inspection_status: isWalkInCustomer ? "completed" : "pending",
      inspection_completed_at: isWalkInCustomer ? walkInSignedAt : null,
      inspection_date: inspection_date ? new Date(inspection_date) : null,
      estimated_installation_date: estimated_installation_date ? new Date(estimated_installation_date) : null,
      inspection_notes: inspection_notes || "",
      // Walk-in specific
      acceptance_method: isWalkInCustomer ? "walk_in_signed_contract" : "online",
      acceptanceMethod: isWalkInCustomer ? "Walk-in Signed Contract" : "Online",
      acceptedByCustomer: false,
      acceptedAt: null,
      transactionCreated: isWalkInCustomer,
      transactionCreatedAt: isWalkInCustomer ? new Date() : null,
      signed_contract_url: isWalkInCustomer ? (signed_contract_url || "") : "",
      contract_number: isWalkInCustomer ? (contract_number || "") : "",
      contract_signed_date: isWalkInCustomer ? walkInSignedAt : null,
      contractStatus: isWalkInCustomer ? "Accepted" : "Not Generated",
      contractGenerated: isWalkInCustomer,
      contractId: isWalkInCustomer ? (contract_number || "") : "",
      contractVersion: isWalkInCustomer ? 1 : 0,
      currentContractVersion: isWalkInCustomer ? 1 : 0,
      contractGeneratedAt: isWalkInCustomer ? walkInSignedAt : null,
      contractHistory: isWalkInCustomer ? [{
        version: 1,
        contractId: contract_number || "",
        generatedAt: walkInSignedAt,
        status: "Accepted",
        acceptedAt: walkInSignedAt,
        acceptanceMethod: "Walk-in Signed Contract",
      }] : [],
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
      .populate("items.product_id", "image_url image images name product_name category product_type unit unit_price price_per_sqft price_per_blade");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (req.user && req.user.role !== "admin" && order.customer._id.toString() !== req.user.id) {
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
    if (status === "site_inspection" && !contract_status) {
      filter.$or = [
        { contract_status: { $in: ["pending", "sent", "declined", ""] } },
        { contract_status: { $exists: false } },
        { contract_status: null },
      ];
    }

    const orders = await Order.find(filter)
      .populate("items.product_id", "image_url image images name category product_type")
      .populate("customer", "first_name last_name email phone street_address city province zip_code")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Get admin orders error:", error);
    res.status(500).json({ success: false, message: "Unable to fetch orders", error: error.message });
  }
};

export const getAdminOrderById = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("customer", "first_name last_name email phone street_address city province zip_code")
      .populate("items.product_id", "image_url image images name category product_type");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Get admin order error:", error);
    res.status(500).json({ success: false, message: "Unable to fetch order", error: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const {
      status,
      contract_status,
      payment_status,
      payment_amount,
      downpayment_amount,
      payment_proof_amount,
      payment_method,
      transaction_number,
      inspection_notes,
      inspection_date,
      warranty_period,
      warranty_start_date,
      warranty_expiry_date,
      warranty_status,
      warranty_terms,
      custom_warranty_days,
      signed_contract_url,
      acceptance_method,
      acceptanceMethod,
      contract_number,
      contract_signed_date,
      inspection_status,
      inspection_completed_at,
      acceptedByCustomer,
      acceptedAt,
      transactionCreated,
      transactionCreatedAt,
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isOrderCompleted = order.status === "completed" || Number(order.progress) >= 100;
    if (String(status || "").toLowerCase() === "cancelled" && isOrderCompleted) {
      return res.status(400).json({
        success: false,
        message: "This project has already been completed and can no longer be cancelled.",
      });
    }

    if (status) order.status = status;
    if (contract_status) order.contract_status = contract_status;
    if (payment_status) order.payment_status = payment_status;
    if (downpayment_amount !== undefined) order.downpayment_amount = Number(downpayment_amount) || 0;
    if (payment_amount !== undefined) order.downpayment_amount = Number(payment_amount) || 0;
    if (payment_proof_amount !== undefined) order.payment_proof_amount = Number(payment_proof_amount) || 0;
    if (payment_method !== undefined) order.payment_method = payment_method || order.payment_method || "Cash";
    if (transaction_number !== undefined) order.transaction_number = transaction_number || "";
    if (inspection_date) order.inspection_date = inspection_date;
    if (inspection_notes) order.inspection_notes = inspection_notes;
    if (warranty_period !== undefined) order.warranty_period = warranty_period !== null && String(warranty_period).trim() !== "" ? String(warranty_period) : "90";
    if (custom_warranty_days !== undefined) order.custom_warranty_days = Number(custom_warranty_days) > 0 ? Number(custom_warranty_days) : null;
    if (signed_contract_url !== undefined) order.signed_contract_url = signed_contract_url || "";
    if (acceptance_method !== undefined) order.acceptance_method = ["online", "walk_in_signed_contract"].includes(String(acceptance_method)) ? acceptance_method : order.acceptance_method;
    if (acceptanceMethod !== undefined) order.acceptanceMethod = acceptanceMethod;
    if (contract_number !== undefined) order.contract_number = contract_number || "";
    if (contract_signed_date !== undefined) order.contract_signed_date = contract_signed_date ? new Date(contract_signed_date) : null;
    if (inspection_status !== undefined) order.inspection_status = inspection_status;
    if (inspection_completed_at !== undefined) order.inspection_completed_at = inspection_completed_at ? new Date(inspection_completed_at) : null;
    if (acceptedByCustomer !== undefined) order.acceptedByCustomer = Boolean(acceptedByCustomer);
    if (acceptedAt !== undefined) order.acceptedAt = acceptedAt ? new Date(acceptedAt) : null;
    if (transactionCreated !== undefined) order.transactionCreated = Boolean(transactionCreated);
    if (transactionCreatedAt !== undefined) order.transactionCreatedAt = transactionCreatedAt ? new Date(transactionCreatedAt) : null;
    if (warranty_period !== undefined) order.warranty_period = warranty_period;
    if (warranty_start_date !== undefined) order.warranty_start_date = warranty_start_date;
    if (warranty_expiry_date !== undefined) {
      order.warranty_expiry_date = warranty_expiry_date;
      if (!warranty_status) {
        const expiry = new Date(warranty_expiry_date);
        order.warranty_status = expiry > new Date() ? "active" : "expired";
      }
    }
    if (warranty_status !== undefined) order.warranty_status = warranty_status;
    if (warranty_terms !== undefined) order.warranty_terms = warranty_terms;

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ success: false, message: "Unable to update order", error: error.message });
  }
};

export const submitOrderReview = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rating, title, comment, photos = [] } = req.body;

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be a number between 1 and 5." });
    }
    if (!comment || typeof comment !== "string" || comment.trim().length < 10 || comment.trim().length > 500) {
      return res.status(400).json({ success: false, message: "Comment must be between 10 and 500 characters." });
    }
    if (!Array.isArray(photos)) {
      return res.status(400).json({ success: false, message: "Photos must be an array." });
    }
    if (photos.length > 5) {
      return res.status(400).json({ success: false, message: "You may upload up to 5 photos." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    if (!order.customer || order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to review this order." });
    }

    const isCompleted = order.status === "completed" && Number(order.progress) >= 100;
    if (!isCompleted) {
      return res.status(400).json({ success: false, message: "Only completed orders may be reviewed." });
    }

    const existingReview = order.review && order.review.submittedAt;
    if (existingReview && !isWithinReviewEditWindow(order.review.submittedAt)) {
      return res.status(400).json({ success: false, message: "This review is locked and can no longer be edited." });
    }

    const now = new Date();
    order.review = {
      rating,
      title: title?.trim() || "",
      comment: comment.trim(),
      photos: photos.slice(0, 5).map((photo) => (typeof photo === "string" ? photo : "")).filter(Boolean),
      submittedAt: existingReview ? order.review.submittedAt : now,
      updatedAt: now,
    };

    await order.save();

    const reviewMessage = buildReviewNotificationMessage(order, order.review);
    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const customerEmail = req.user.email || order.customer_email || "";

    try {
      await sendMail({
        to: adminEmail,
        subject: `New customer review received for ${order.tracking}`,
        text: reviewMessage,
      });
    } catch (mailError) {
      console.error("Review notification email failed:", mailError);
    }

    if (customerEmail) {
      try {
        await sendMail({
          to: customerEmail,
          subject: "Thank you for your review",
          text: `Thank you for your feedback on order ${order.tracking}. Your review has been submitted successfully.`,
        });
      } catch (mailError) {
        console.error("Customer review confirmation email failed:", mailError);
      }
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Submit order review error:", error);
    res.status(500).json({ success: false, message: "Unable to submit review.", error: error.message });
  }
};

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required." });
    }

    const reviews = await Order.find({
      "items.product_id": productId,
      "review.submittedAt": { $ne: null },
    })
      .populate("customer", "first_name last_name")
      .populate("items.product_id", "name")
      .sort({ "review.submittedAt": -1 })
      .lean();

    const mappedReviews = reviews
      .flatMap((order) =>
        (order.items || [])
          .filter((item) => item.product_id && String(item.product_id._id || item.product_id) === String(productId))
          .map((item) => ({
            orderId: order._id,
            tracking: order.tracking,
            productName: item.name,
            customerName: order.customer ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim() : order.customer_name || "Customer",
            rating: order.review?.rating || 0,
            title: order.review?.title || "",
            comment: order.review?.comment || "",
            photos: order.review?.photos || [],
            submittedAt: order.review?.submittedAt || null,
          }))
      )
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    res.json({ success: true, reviews: mappedReviews });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({ success: false, message: "Unable to fetch product reviews.", error: error.message });
  }
};

export const respondToContract = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, declineReason = "" } = req.body;

    if (!action || !["accept", "decline"].includes(action)) {
      return res.status(400).json({ success: false, message: "Contract action must be accept or decline." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.customer || order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to respond to this contract." });
    }

    const orderStatus = (order.status || "").toString().toLowerCase();
    const contractStatus = (order.contract_status || "").toString().toLowerCase();
    const isAwaitingCustomerResponse =
      (orderStatus === "contract_sent" || orderStatus === "site_inspection" || contractStatus === "sent") &&
      !["accepted", "declined"].includes(contractStatus) &&
      !["contract_accepted", "contract_declined", "cancelled"].includes(orderStatus);

    if (action === "accept" && (orderStatus === "contract_accepted" || contractStatus === "accepted")) {
      return res.json({ success: true, order, message: "Contract already accepted." });
    }

    if (!isAwaitingCustomerResponse) {
      return res.status(400).json({ success: false, message: "Contract cannot be responded to at this stage." });
    }

    if (action === "decline" && !String(declineReason).trim()) {
      return res.status(400).json({ success: false, message: "Please provide a reason for declining the contract." });
    }

    if (order.order_type === "walk_in_customer") {
      return res.status(400).json({ success: false, message: "Walk-in contracts must be verified by an admin." });
    }

    if (action === "accept") {
      const acceptedAt = new Date();
      order.contract_status = "accepted";
      order.status = "contract_accepted";
      order.contractStatus = "Accepted";
      order.acceptance_method = "online";
      order.acceptanceMethod = "Online";
      order.acceptedByCustomer = true;
      order.acceptedAt = acceptedAt;
      order.contract_signed_date = acceptedAt;
      order.inspection_status = "completed";
      order.inspection_completed_at = acceptedAt;
      if (order.transactionCreated !== true) {
        order.transactionCreated = true;
        order.transactionCreatedAt = acceptedAt;
      }
      const activeContract = Array.isArray(order.contractHistory)
        ? order.contractHistory.find((entry) => entry.status === "Current")
        : null;
      if (activeContract) {
        activeContract.status = "Accepted";
        activeContract.acceptedAt = acceptedAt;
        activeContract.acceptanceMethod = "Online";
      }
    } else {
      order.contract_status = "declined";
      order.status = "site_inspection";
      order.contractStatus = "Declined";
      order.contractDeclineReason = String(declineReason).trim();
      order.contractDeclinedAt = new Date();
    }

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Respond to contract error:", error);
    res.status(500).json({ success: false, message: "Unable to update contract response", error: error.message });
  }
};

export const cancelCustomerOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.customer || order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this order." });
    }

    if (order.status === "cancelled") {
      return res.json({ success: true, order, message: "Order already cancelled." });
    }

    const isCompleted = order.status === "completed" || Number(order.progress) >= 100;
    if (isCompleted) {
      return res.status(400).json({
        success: false,
        message: "This order has already been completed and cannot be cancelled.",
      });
    }

    order.status = "cancelled";
    if (order.contract_status === "accepted") {
      order.contract_status = "declined";
    }

    await order.save();

    res.json({ success: true, order, message: "Order cancelled successfully." });
  } catch (error) {
    console.error("Cancel customer order error:", error);
    res.status(500).json({ success: false, message: "Unable to cancel order", error: error.message });
  }
};

export const submitCustomerPaymentProof = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, payment_method, transaction_number, proof_file_name, proof_file_url } = req.body || {};

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ success: false, message: "Please enter a valid payment amount." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (!order.customer || order.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to update payment proof for this order." });
    }

    order.payment_status = "paid";
    order.payment_proof_amount = normalizedAmount;
    order.payment_proof_file_name = proof_file_name || order.payment_proof_file_name || "";
    order.payment_proof_file_url = proof_file_url || order.payment_proof_file_url || "";
    order.payment_method = payment_method || order.payment_method || "Cash";
    order.transaction_number = transaction_number || order.transaction_number || "";

    await order.save();

    res.json({
      success: true,
      message: "Payment proof submitted successfully.",
      order,
    });
  } catch (error) {
    console.error("Submit customer payment proof error:", error);
    res.status(500).json({ success: false, message: "Unable to submit payment proof", error: error.message });
  }
};

export const respondToInstallationSchedule = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, reason, preferredInstallationDate, preferredInstallationTime, notes } = req.body;

    if (!action || !["accept", "reschedule", "accept_preferred"].includes(action)) {
      return res.status(400).json({ success: false, message: "Schedule action must be accept, reschedule, or accept_preferred." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const isCustomer = order.customer && order.customer.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    // Accept preferred requires admin, other actions require customer
    if (action === "accept_preferred") {
      if (!isAdmin) {
        return res.status(403).json({ success: false, message: "Only admins can accept preferred schedules." });
      }
    } else {
      if (!isCustomer) {
        return res.status(403).json({ success: false, message: "Not authorized to respond to this installation schedule." });
      }
    }

    const scheduleStageKeys = ["installation_scheduling", "installation_scheduled", "installation_agreement"];
    const scheduleStages = Array.isArray(order.progress_stages)
      ? order.progress_stages.filter((stage) => {
          const scheduleStageKey = (stage.key || stage.name || "").toString().toLowerCase().replace(/\s+/g, "_");
          return scheduleStageKeys.includes(scheduleStageKey);
        })
      : [];
    const scheduleStage =
      scheduleStages.find((stage) => stage.customerResponse === "reschedule_requested") ||
      scheduleStages.find((stage) => stage.proposedInstallationDate || stage.proposedInstallationTime) ||
      scheduleStages[0] ||
      null;

    if (!scheduleStage) {
      return res.status(400).json({ success: false, message: "Installation schedule is not available for response." });
    }

    const hasProposal = scheduleStage.proposedInstallationDate || scheduleStage.proposedInstallationTime;
    const hasPreferredProposal = scheduleStage.customerPreferredInstallationDate || scheduleStage.customerPreferredInstallationTime;

    if (action !== "accept_preferred" && !hasProposal) {
      return res.status(400).json({ success: false, message: "No installation proposal is available to respond to." });
    }

    if (action === "accept") {
      const alreadyAccepted = scheduleStage.customerResponse === "accepted" && scheduleStage.completed;
      if (alreadyAccepted) {
        return res.json({ success: true, order, message: "Installation schedule already accepted." });
      }

      scheduleStage.customerResponse = "accepted";
      scheduleStage.customerResponseAt = new Date();
      scheduleStage.customerDeclineReason = "";
      scheduleStage.customerPreferredInstallationDate = null;
      scheduleStage.customerPreferredInstallationTime = "";
      scheduleStage.customerRescheduleNotes = "";
      scheduleStage.completed = true;
      scheduleStage.status = "done";
      scheduleStage.date = new Date();
      order.status = order.status === "contract_accepted" ? "contract_accepted" : order.status;
    } else if (action === "accept_preferred") {
      // Admin accepting customer's preferred reschedule
      const alreadyAcceptedPreferred =
        scheduleStage.customerResponse === "accepted" &&
        scheduleStage.completed &&
        (scheduleStage.customerPreferredInstallationDate || scheduleStage.customerPreferredInstallationTime);
      if (alreadyAcceptedPreferred) {
        const installationStage = Array.isArray(order.progress_stages)
          ? order.progress_stages.find((stage) => {
              const stageKey = (stage.key || stage.name || "").toString().toLowerCase().replace(/\s+/g, "_");
              return stageKey === "installation";
            })
          : null;
        if (installationStage && !installationStage.completed && installationStage.status !== "in_progress") {
          installationStage.status = "in_progress";
          await order.save();
        }
        return res.json({ success: true, order, message: "Customer preferred schedule already accepted." });
      }

      if (scheduleStage.customerResponse !== "reschedule_requested") {
        return res.status(400).json({
          success: false,
          message: `Customer has not requested a reschedule. Current status: ${scheduleStage.customerResponse || "unknown"}.`,
        });
      }

      if (!hasPreferredProposal) {
        return res.status(400).json({
          success: false,
          message: "No customer preferred schedule is available to accept. Missing date or time.",
        });
      }

      // Update the proposed date/time to the customer's preferred values
      scheduleStage.proposedInstallationDate = scheduleStage.customerPreferredInstallationDate
        ? new Date(scheduleStage.customerPreferredInstallationDate)
        : null;
      scheduleStage.proposedInstallationTime = scheduleStage.customerPreferredInstallationTime || "";
      scheduleStage.customerResponse = "accepted";
      scheduleStage.customerResponseAt = new Date();
      scheduleStage.completed = true;
      scheduleStage.status = "done";
      scheduleStage.date = new Date();
      const installationStage = Array.isArray(order.progress_stages)
        ? order.progress_stages.find((stage) => {
            const stageKey = (stage.key || stage.name || "").toString().toLowerCase().replace(/\s+/g, "_");
            return stageKey === "installation";
          })
        : null;
      if (installationStage && !installationStage.completed) {
        installationStage.status = "in_progress";
      }
      order.status = order.status === "contract_accepted" ? "contract_accepted" : order.status;
    } else {
      if (!reason || !preferredInstallationDate || !preferredInstallationTime) {
        return res.status(400).json({
          success: false,
          message: "Reschedule requests require a reason, preferred installation date, and preferred installation time.",
        });
      }

      scheduleStage.customerResponse = "reschedule_requested";
      scheduleStage.customerResponseAt = new Date();
      scheduleStage.customerDeclineReason = reason.trim();
      scheduleStage.customerPreferredInstallationDate = new Date(preferredInstallationDate);
      scheduleStage.customerPreferredInstallationTime = preferredInstallationTime.trim();
      scheduleStage.customerRescheduleNotes = notes ? notes.trim() : "";
      scheduleStage.completed = false;
      scheduleStage.status = "pending";
      order.status = order.status === "contract_accepted" ? "contract_accepted" : order.status;
    }

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Respond to installation schedule error:", error);
    res.status(500).json({ success: false, message: "Unable to update installation schedule response", error: error.message });
  }
};

export const updateOrderInspection = async (req, res) => {
  let updateData = {};

  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { inspection_status, inspection_date, estimated_installation_date, inspection_notes, issues_found, shipping_address, payment_terms, agreed_payment_date, items, total_amount, customer_name, customer_email, customer_phone, has_account_on_website, downpayment_received, manual_override, warranty_period, custom_warranty_days } = req.body;

    updateData = {
      status: "site_inspection",
    };

    if (inspection_status !== undefined) updateData.inspection_status = inspection_status;
    if (inspection_date !== undefined) {
      updateData.inspection_date = inspection_date;
      if (inspection_status === undefined || inspection_status === null) {
        updateData.inspection_status = "scheduled";
      }
    }
    if (estimated_installation_date !== undefined) {
      const parsedInstallationDate = estimated_installation_date ? new Date(estimated_installation_date) : null;
      if (parsedInstallationDate && Number.isNaN(parsedInstallationDate.getTime())) {
        return res.status(400).json({ success: false, message: "Estimated installation date must be a valid date." });
      }
      updateData.estimated_installation_date = parsedInstallationDate;
    }
    if (inspection_notes !== undefined) updateData.inspection_notes = inspection_notes;
    if (issues_found !== undefined) updateData.issues_found = issues_found;
    if (shipping_address !== undefined) updateData.shipping_address = normalizeAddress(shipping_address || "");
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms || "";
    if (agreed_payment_date !== undefined) {
      const parsedAgreedDate = agreed_payment_date ? new Date(agreed_payment_date) : null;
      if (agreed_payment_date && Number.isNaN(parsedAgreedDate.getTime())) {
        return res.status(400).json({ success: false, message: "Agreed payment date must be a valid date." });
      }
      updateData.agreed_payment_date = parsedAgreedDate;
    }
    if (has_account_on_website !== undefined) updateData.has_account_on_website = Boolean(has_account_on_website);
    if (downpayment_received !== undefined) updateData.downpayment_received = Boolean(downpayment_received);
    if (warranty_period !== undefined) updateData.warranty_period = warranty_period !== null && String(warranty_period).trim() !== "" ? String(warranty_period) : "90";
    if (custom_warranty_days !== undefined) updateData.custom_warranty_days = Number(custom_warranty_days) > 0 ? Number(custom_warranty_days) : null;
    if (manual_override !== undefined) updateData.manual_override = Number(manual_override) || 0;
    if (customer_name !== undefined) updateData.customer_name = customer_name || "";
    if (customer_email !== undefined) updateData.customer_email = customer_email || "";
    if (customer_phone !== undefined) updateData.customer_phone = customer_phone || "";
    if (Array.isArray(items)) {
      const sanitizedItems = sanitizeOrderItems(items);
      const invalidItem = sanitizedItems.find((item) => !item.product_id || !item.name);
      if (invalidItem) {
        return res.status(400).json({ success: false, message: "Invalid item data in inspection update." });
      }
      updateData.items = sanitizedItems;
    }
    if (total_amount !== undefined) {
      updateData.total_amount = Number(total_amount) || 0;
    }

    const order = await Order.findById(orderId).populate(
      "customer",
      "first_name last_name email phone street_address city province zip_code"
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const registeredCustomer = order.customer?._id ? order.customer : null;
    if (registeredCustomer) {
      const registeredName = `${registeredCustomer.first_name || ""} ${registeredCustomer.last_name || ""}`.trim();
      updateData.customer_name = registeredName || order.customer_name || "";
      updateData.customer_email = registeredCustomer.email || "";
      updateData.customer_phone = registeredCustomer.phone || "";
      updateData.has_account_on_website = true;
      updateData.shipping_address = normalizeAddress(order.shipping_address || buildAddressFromUser(registeredCustomer));
    }

    const updatedTotalAmount = total_amount !== undefined ? Number(total_amount) || 0 : order.total_amount;
    const updatedPaymentTerms = payment_terms !== undefined ? payment_terms : order.payment_terms;
    updateData.contract_amount = updatedTotalAmount;
    updateData.downpayment_amount = updatedPaymentTerms === "full_payment" ? updatedTotalAmount : updatedTotalAmount * 0.5;

    Object.assign(order, updateData);
    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Update inspection payload:", JSON.stringify(req.body, null, 2));
    console.error("Update inspection data:", JSON.stringify(updateData, null, 2));
    console.error("Update inspection error name:", error.name);
    console.error("Update inspection error:", error);
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Inspection update failed validation",
        details: error.name === "ValidationError"
          ? Object.values(error.errors).map((err) => err.message)
          : [error.message],
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Unable to update inspection",
      error: error.name,
      details: error.stack || error.errors || null,
    });
  }
};

export const updateOrderProgress = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { progress, status, installation_date, stages, proof_images } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (typeof progress !== "undefined") order.progress = Number(progress) || 0;

    // Map friendly status values back to internal statuses when possible
    const mapFriendlyToInternal = (s) => {
      if (!s) return undefined;
      const key = String(s).toLowerCase();
      if (key.includes("fabrication") || key.includes("processing")) return "processing";
      if (key.includes("installation") || key.includes("site_inspection")) return "site_inspection";
      if (key.includes("completed")) return "completed";
      if (key.includes("cutting")) return "processing";
      if (key.includes("pending")) return "admin_review";
      if (key.includes("delayed")) return "processing";
      return undefined;
    };

    const mapped = mapFriendlyToInternal(status);
    if (mapped) order.status = mapped;

    if (installation_date) {
      // store as inspection_date for compatibility with existing schema
      order.inspection_date = installation_date;
    }

    if (Array.isArray(stages)) {
      order.progress_stages = stages.map((s) => ({
        key: s.key || (s.name || "").toString().toLowerCase().replace(/\s+/g, "_"),
        name: s.name || "",
        status: ["pending", "in_progress", "done", "delayed", "on_hold"].includes(s.status) ? s.status : s.completed ? "done" : "pending",
        completed: !!s.completed,
        date: s.date ? new Date(s.date) : null,
        delayReason: s.delayReason || "",
        delayExpectedResolution: s.delayExpectedResolution ? new Date(s.delayExpectedResolution) : null,
        delayNotes: s.delayNotes || "",
        delayReportedAt: s.delayReportedAt ? new Date(s.delayReportedAt) : null,
        delayReportedBy: s.delayReportedBy || "",
        proposedInstallationDate: s.proposedInstallationDate ? new Date(s.proposedInstallationDate) : null,
        proposedInstallationTime: s.proposedInstallationTime ? String(s.proposedInstallationTime).trim() : "",
        delayHistory: Array.isArray(s.delayHistory)
          ? s.delayHistory.map((entry) => ({
              reason: entry.reason || "",
              expectedResolution: entry.expectedResolution ? new Date(entry.expectedResolution) : null,
              notes: entry.notes || "",
              reportedAt: entry.reportedAt ? new Date(entry.reportedAt) : null,
              reportedBy: entry.reportedBy || "",
              status: entry.status || "delayed",
              resolvedAt: entry.resolvedAt ? new Date(entry.resolvedAt) : null,
            }))
          : [],
        images: Array.isArray(s.images) ? s.images : [],
        customerResponse: ["pending", "accepted", "declined", "reschedule_requested"].includes(s.customerResponse)
          ? s.customerResponse
          : "pending",
        customerResponseAt: s.customerResponseAt ? new Date(s.customerResponseAt) : null,
        customerDeclineReason: s.customerDeclineReason ? s.customerDeclineReason : "",
        customerPreferredInstallationDate: s.customerPreferredInstallationDate ? new Date(s.customerPreferredInstallationDate) : null,
        customerPreferredInstallationTime: s.customerPreferredInstallationTime ? s.customerPreferredInstallationTime : "",
        customerRescheduleNotes: s.customerRescheduleNotes ? s.customerRescheduleNotes : "",
        subStages: Array.isArray(s.subStages)
          ? s.subStages.map((sub) => ({
              name: sub.name || "",
              description: sub.description || "",
              status: ["pending", "in_progress", "done", "delayed", "on_hold"].includes(sub.status)
                ? sub.status
                : sub.completed
                ? "done"
                : "pending",
              completed: !!sub.completed,
              date: sub.date ? new Date(sub.date) : null,
              images: Array.isArray(sub.images) ? sub.images : [],
            }))
          : [],
      }));

      const delayReporter = req.user?.email || "";
      order.progress_stages = order.progress_stages.map((stage) => {
        const history = Array.isArray(stage.delayHistory)
          ? stage.delayHistory.map((entry) => ({
              ...entry,
              reportedBy: entry.reportedBy || delayReporter,
            }))
          : [];

        const last = history[history.length - 1];
        if (stage.status !== "delayed" && last && last.status === "delayed" && !last.resolvedAt) {
          history[history.length - 1] = {
            ...last,
            resolvedAt: new Date(),
          };
        }

        return {
          ...stage,
          delayReportedBy: stage.delayReportedBy || delayReporter,
          delayHistory: history,
        };
      });

      const allProjectStagesDone =
        order.progress_stages.length > 0 &&
        order.progress_stages.every((stage) => stage.completed === true);
      if (allProjectStagesDone) {
        order.status = "completed";
      }

      // If a site inspection stage exists, keep inspection_date/status in sync
      try {
        const inspectionStage = order.progress_stages.find((s) => {
          const key = (s.key || "").toString().toLowerCase();
          const name = (s.name || "").toString().toLowerCase();
          return (
            key.includes("site_inspection") ||
            name.includes("site inspection") ||
            key.includes("inspection") ||
            name.includes("inspection") ||
            // treat installation-named stages as inspection-related for compatibility
            key.includes("installation") ||
            name.includes("installation")
          );
        });

        if (inspectionStage) {
          // If admin saved a proposed date/time for inspection/scheduling, keep inspection_date in sync
          if (inspectionStage.proposedInstallationDate) {
            order.inspection_date = inspectionStage.proposedInstallationDate;
            // mark scheduled unless already completed
            if (order.inspection_status !== "completed") order.inspection_status = "scheduled";
          }

          // If the inspection stage is completed, ensure the order's inspection_status is marked completed
          if (inspectionStage.completed) {
            order.inspection_status = "completed";
            if (inspectionStage.date) {
              order.inspection_date = inspectionStage.date;
            }
          }
        }
      } catch (syncErr) {
        console.warn("Failed to sync inspection stage to order fields:", syncErr && syncErr.message ? syncErr.message : syncErr);
      }
    }

    // Accept an array of proof_images to append to the last stage or attachments
    if (Array.isArray(proof_images) && proof_images.length > 0) {
      order.attachments = Array.isArray(order.attachments) ? order.attachments.concat(proof_images) : proof_images.slice();
      if (order.progress_stages && order.progress_stages.length > 0) {
        const last = order.progress_stages[order.progress_stages.length - 1];
        last.images = Array.isArray(last.images) ? last.images.concat(proof_images) : proof_images.slice();
      }
    }

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Update order progress error:", error);
    res.status(500).json({ success: false, message: "Unable to update order progress", error: error.message });
  }
};

export const generateContract = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { contract_terms, contract_amount, snapshot, regenerate = false } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const version = regenerate
      ? Number(order.currentContractVersion || order.contractVersion || 0) + 1
      : Number(order.currentContractVersion || order.contractVersion || 0) || 1;

    const nextContractId = order.contractId || `ACGC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const history = Array.isArray(order.contractHistory) ? order.contractHistory.map((entry) => ({
      ...entry,
      status: entry.status === "Current" ? "Superseded" : entry.status,
    })) : [];

    history.push({
      version,
      contractId: nextContractId,
      generatedAt: new Date(),
      status: "Current",
      snapshot: snapshot || order.contractSnapshot || {},
    });

    order.contractGenerated = true;
    order.contractId = nextContractId;
    order.contractVersion = version;
    order.currentContractVersion = version;
    order.contractGeneratedAt = new Date();
    order.contractNeedsRegeneration = false;
    order.contractStatus = "Created";
    order.contractSnapshot = snapshot || order.contractSnapshot || {};
    order.contractHistory = history;
    order.contract_status = "pending";
    order.contractSentAt = null;
    order.contract_terms = contract_terms || "";
    order.contract_amount = Number(contract_amount) || order.total_amount;
    order.downpayment_amount = order.payment_terms === "full_payment" ? order.contract_amount : order.contract_amount * 0.5;
    order.inspection_status = order.inspection_status || "pending";

    if (order.status === "contract_sent") {
      order.status = "site_inspection";
    }

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Generate contract error:", error);
    res.status(500).json({ success: false, message: "Unable to generate contract", error: error.message });
  }
};

export const sendWalkInApprovalEmail = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { orderId } = req.params;
    const { customerName, customerEmail, contractUrl, contractAttachment } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const customerEmailValue = (customerEmail || order.customer_email || "").trim();
    const isWalkInCustomer = String(order.order_type || "") === "walk_in_customer";

    if (!isWalkInCustomer && !customerEmailValue) {
      return res.status(400).json({ success: false, message: "Customer email is required" });
    }

    // Build the email from the saved inspection so the customer receives the
    // same project details that admins see in the contract modal.
    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const customerNameValue = customerName || order.customer_name || "Valued Customer";
    const orderNumber = order.tracking || "N/A";
    const inspectionDate = order.inspection_date
      ? new Date(order.inspection_date).toLocaleDateString()
      : "N/A";
    const totalAmount = typeof order.total_amount === "number"
      ? `₱${order.total_amount.toFixed(2)}`
      : "N/A";
    const siteAddress = order.shipping_address || "N/A";
    const paymentTerms = order.payment_terms || "50% downpayment, 50% upon completion";
    const warrantyPeriod = order.warranty_period ? `${order.warranty_period} days` : "90 days";
    const inspectionNotes = order.inspection_notes || "No additional site notes provided.";
    const contractLink = contractUrl || order.signed_contract_url || "";
    const fromAddress = process.env.EMAIL_FROM || "ACGC Site Inspection <no-reply@acgc.com>";
    const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const contractLoginLink = `${frontendUrl}/customer-dashboard?tab=contracts&orderId=${encodeURIComponent(order._id)}`;
    const itemRows = (order.items || []).map((item) => {
      const quantity = Number(item.quantity) || 1;
      const width = Number(item.width) || 0;
      const height = Number(item.height) || 0;
      const area = Number(item.area) || 0;
      const amount = Number(item.estimated_price) || (Number(item.unit_price) || 0) * quantity;
      return {
        name: item.name || "Inspection item",
        quantity,
        dimensions: `${width} x ${height} in`,
        area: `${area.toFixed(2)} sq ft`,
        amount: `₱${amount.toFixed(2)}`,
      };
    });
    const itemHtml = itemRows.length > 0
      ? itemRows.map((item) => `
          <tr>
            <td style="border:1px solid #d1d5db;padding:8px">${escapeHtml(item.name)}</td>
            <td style="border:1px solid #d1d5db;padding:8px;text-align:center">${item.quantity}</td>
            <td style="border:1px solid #d1d5db;padding:8px">${escapeHtml(item.dimensions)}</td>
            <td style="border:1px solid #d1d5db;padding:8px">${escapeHtml(item.area)}</td>
            <td style="border:1px solid #d1d5db;padding:8px;text-align:right">${escapeHtml(item.amount)}</td>
          </tr>`).join("")
      : `<tr><td colspan="5" style="border:1px solid #d1d5db;padding:8px">No measurement items recorded.</td></tr>`;

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;color:#111827">
        <h2 style="color:#dc2626">ACGC Glass &amp; Aluminum Services</h2>
        <p>Hi ${escapeHtml(customerNameValue)},</p>
        <p>Your site inspection contract details are attached as a PDF file.</p>
        <p><a href="${escapeHtml(contractLoginLink)}" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px">Log in to view your contract</a></p>
        <p>Please review the attached document and contact our support team if anything needs to be corrected.</p>
        <p>Thank you,<br/>ACGC Site Inspection Team</p>
      </div>
    `;

    const textBody = `
Hi ${customerNameValue},

Your site inspection contract details are attached as a PDF file.

Log in to view your contract: ${contractLoginLink}

Please review the attached document and contact our support team if anything needs to be corrected.

Thank you,
ACGC Site Inspection Team
`;

    const contractPdf = await createContractPdfAttachment({
      customerName: customerNameValue,
      orderNumber,
      inspectionDate,
      siteAddress,
      paymentTerms,
      warrantyPeriod,
      inspectionNotes,
      totalAmount,
      itemRows,
    });
    const renderedContractAttachment = getDataUrlAttachment(
      contractAttachment,
      `ACGC-site-inspection-${orderNumber}.pdf`
    );
    const attachments = [renderedContractAttachment || {
      filename: `ACGC-site-inspection-${orderNumber}.pdf`,
      content: contractPdf,
      contentType: "application/pdf",
    }];
    const uploadedContractAttachment = getLocalUploadedAttachment(contractLink);
    if (uploadedContractAttachment) {
      attachments.push(uploadedContractAttachment);
    }

    try {
      if (customerEmailValue) {
        await sendMail({
          from: fromAddress,
          to: customerEmailValue,
          subject: "ACGC Site Inspection Contract Details",
          text: textBody,
          html: htmlBody,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      }

      order.contract_status = "sent";
      order.contractStatus = "Sent";
      order.contractSentAt = new Date();
      order.status = "site_inspection";
      await order.save();

      res.json({
        success: true,
        message: isWalkInCustomer
          ? "Walk-in approval processed successfully"
          : "Approval email sent successfully",
      });
    } catch (emailError) {
      console.error("Approval email send failed:", emailError);
      const message = emailError?.code === "EAUTH"
        ? "Email service authentication failed. Update the SMTP credentials or Gmail app password."
        : "Unable to send email";
      return res.status(500).json({
        success: false,
        message,
        code: emailError?.code,
      });
    }
  } catch (error) {
    console.error("Send approval email error:", error);
    res.status(500).json({ success: false, message: "Unable to send email", error: error.message });
  }
};

import fs from "fs";
import path from "path";
import Order from "../models/Order.js";
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

const normalizeProductId = (productId) => {
  if (!productId) return null;
  if (typeof productId === "object") {
    return String(productId._id || productId.id || productId);
  }
  return String(productId);
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
    const estimation_mode = item.estimation_mode === "manual" ? "manual" : "auto";
    const manual_estimated_total = Number(item.manual_estimated_total) || 0;

    return {
      product_id: normalizeProductId(item.product_id) || normalizeProductId(item._id) || null,
      name: item.name,
      quantity,
      unit_price,
      unit: item.unit || "piece",
      measurement_unit: item.measurement_unit || item.measurementUnit || item.unit || "in",
      width,
      height,
      area,
      estimated_price,
      estimation_mode,
      manual_estimated_total,
      notes: item.notes || "",
      is_estimate: Boolean(item.is_estimate),
    };
  });
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
    const { 
      items, 
      shipping_address, 
      order_type, 
      attachments, 
      payment_terms, 
      customer_name, 
      customer_phone, 
      customer_email, 
      customer_id,
      // Walk-in customer fields
      signed_contract_url,
      contract_number,
      contract_signed_date,
      inspection_date,
      inspection_notes,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order items are required" });
    }

    // Validate walk-in customer requirements
    if (order_type === "walk_in_customer") {
      if (!signed_contract_url) {
        return res.status(400).json({ success: false, message: "Signed contract is required for walk-in customers" });
      }
    }

    const sanitizedItems = sanitizeOrderItems(items);

    const totalAmountFromItems = sanitizedItems.reduce((sum, item) => {
      const itemAmount = item.is_estimate && item.estimated_price ? item.estimated_price : item.quantity * item.unit_price;
      return sum + itemAmount;
    }, 0);

    const overrideAmount = Number(req.body.estimated_cost) || 0;
    const total_amount = overrideAmount > 0 ? overrideAmount : totalAmountFromItems;

    const order = new Order({
      customer: customer_id || undefined,
      customer_name: customer_name || "",
      customer_phone: customer_phone || "",
      customer_email: customer_email || "",
      items: sanitizedItems,
      total_amount,
      shipping_address: normalizeAddress(shipping_address || ""),
      payment_terms: payment_terms || "",
      attachments: Array.isArray(attachments) ? attachments : [],
      tracking: generateTrackingNumber(),
      order_type: order_type === "walk_in_customer" ? "walk_in_customer" : "online_order",
      contract_status: order_type === "walk_in_customer" ? "accepted" : "pending",
      payment_status: "not_paid",
      status: order_type === "walk_in_customer" ? "contract_accepted" : "site_inspection",
      inspection_status: order_type === "walk_in_customer" ? "completed" : "pending",
      inspection_date: inspection_date ? new Date(inspection_date) : null,
      inspection_notes: inspection_notes || "",
      // Walk-in specific
      acceptance_method: order_type === "walk_in_customer" ? "walk_in_signed_contract" : "online",
      signed_contract_url: signed_contract_url || "",
      contract_number: contract_number || "",
      contract_signed_date: contract_signed_date ? new Date(contract_signed_date) : null,
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
    if (status === "site_inspection" && !contract_status) {
      filter.contract_status = "pending";
      filter.contract_terms = "";
      filter.contract_amount = { $in: [0, null] };
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
      inspection_notes,
      inspection_date,
      warranty_period,
      warranty_start_date,
      warranty_expiry_date,
      warranty_status,
      warranty_terms,
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
    if (inspection_date) order.inspection_date = inspection_date;
    if (inspection_notes) order.inspection_notes = inspection_notes;
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
    const { action } = req.body;

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
      orderStatus === "contract_sent" || contractStatus === "sent";

    if (action === "accept" && (orderStatus === "contract_accepted" || contractStatus === "accepted")) {
      return res.json({ success: true, order, message: "Contract already accepted." });
    }

    if (!isAwaitingCustomerResponse) {
      return res.status(400).json({ success: false, message: "Contract cannot be responded to at this stage." });
    }

    if (action === "accept") {
      order.contract_status = "accepted";
      order.status = "contract_accepted";
    } else {
      order.contract_status = "declined";
      order.status = "cancelled";
    }

    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    console.error("Respond to contract error:", error);
    res.status(500).json({ success: false, message: "Unable to update contract response", error: error.message });
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
    const { inspection_status, inspection_date, inspection_notes, issues_found, shipping_address, payment_terms, items, total_amount, customer_name, customer_email, customer_phone } = req.body;

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
    if (inspection_notes !== undefined) updateData.inspection_notes = inspection_notes;
    if (issues_found !== undefined) updateData.issues_found = issues_found;
    if (shipping_address !== undefined) updateData.shipping_address = normalizeAddress(shipping_address || "");
    if (payment_terms !== undefined) updateData.payment_terms = payment_terms || "";
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

    const order = await Order.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
      context: "query",
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

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
    const { contract_terms, contract_amount } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.contract_status = "sent";
    order.contract_terms = contract_terms || "";
    order.contract_amount = Number(contract_amount) || order.total_amount;
    order.inspection_status = "completed";
    order.status = "contract_sent";

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
    const { customerName, customerEmail, contractUrl } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const customerEmailValue = (customerEmail || order.customer_email || "").trim();
    if (!customerEmailValue) {
      return res.status(400).json({ success: false, message: "Customer email is required" });
    }

    // Prepare email content
    const customerNameValue = customerName || order.customer_name || "Valued Customer";
    const orderNumber = order.tracking || "N/A";
    const inspectionDate = order.inspection_date
      ? new Date(order.inspection_date).toLocaleDateString()
      : "N/A";
    const totalAmount = typeof order.total_amount === "number"
      ? `₱${order.total_amount.toFixed(2)}`
      : "N/A";
    const siteAddress = order.shipping_address || "N/A";
    const contractLink = contractUrl || order.signed_contract_url || "";
    const fromAddress = process.env.EMAIL_FROM || "ACGC Site Inspection <no-reply@acgc.com>";

    const htmlBody = `
      <p>Hi ${customerNameValue},</p>
      <p>Your walk-in site inspection has been completed and the proposal is ready for review.</p>
      <p><strong>Order Number:</strong> ${orderNumber}</p>
      <p><strong>Inspection Date:</strong> ${inspectionDate}</p>
      <p><strong>Total Amount:</strong> ${totalAmount}</p>
      <p><strong>Site Address:</strong> ${siteAddress}</p>
      ${contractLink ? `<p><strong>Signed Contract:</strong> <a href="${contractLink}">View signed contract</a></p>` : ""}
      <p>If you have any questions, reply to this email or contact our support team.</p>
      <p>Thank you,<br/>ACGC Site Inspection Team</p>
    `;

    const textBody = `
Hi ${customerNameValue},

Your walk-in site inspection has been completed and the proposal is ready for review.

Order Number: ${orderNumber}
Inspection Date: ${inspectionDate}
Total Amount: ${totalAmount}
Site Address: ${siteAddress}
${contractLink ? `
View signed contract: ${contractLink}` : ""}

If you have any questions, reply to this email or contact our support team.

Thank you,
ACGC Site Inspection Team
`;

    const attachments = [];
    const contractAttachment = getLocalUploadedAttachment(contractLink);
    if (contractAttachment) {
      attachments.push(contractAttachment);
    }

    try {
      await sendMail({
        from: fromAddress,
        to: customerEmailValue,
        subject: "ACGC Site Inspection & Proposal",
        text: textBody,
        html: htmlBody,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      res.json({
        success: true,
        message: "Approval email sent successfully",
      });
    } catch (emailError) {
      console.error("Approval email send failed:", emailError);
      return res.status(500).json({
        success: false,
        message: "Unable to send email",
        error: emailError?.message || "Email sending failed",
        code: emailError?.code,
      });
    }
  } catch (error) {
    console.error("Send approval email error:", error);
    res.status(500).json({ success: false, message: "Unable to send email", error: error.message });
  }
};

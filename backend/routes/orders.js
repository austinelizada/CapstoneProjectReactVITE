import express from "express";
import { authMiddleware, permissionMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  createOrder,
  createOrderAsAdmin,
  listOrders,
  trackOrder,
  getProductReviews,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderInspection,
  updateOrderProgress,
  generateContract,
  submitOrderReview,
  respondToContract,
  respondToInstallationSchedule,
  sendWalkInApprovalEmail,
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/", authMiddleware, listOrders);
router.post("/", authMiddleware, roleMiddleware("customer"), permissionMiddleware("can_request_orders"), createOrder);
router.get("/track/:tracking", authMiddleware, permissionMiddleware("can_track_products"), trackOrder);
router.put("/:orderId/contract", authMiddleware, roleMiddleware("customer"), respondToContract);
router.put("/:orderId/installation-schedule", authMiddleware, respondToInstallationSchedule);
router.put("/:orderId/review", authMiddleware, roleMiddleware("customer"), permissionMiddleware("can_upload_feedback"), submitOrderReview);
router.get("/reviews/product/:productId", authMiddleware, permissionMiddleware("can_upload_feedback"), getProductReviews);

// Admin routes
router.get("/admin/list", authMiddleware, roleMiddleware("admin"), getAdminOrders);
router.get("/admin/:orderId", authMiddleware, roleMiddleware("admin"), getAdminOrderById);
router.post("/admin/create", authMiddleware, roleMiddleware("admin"), createOrderAsAdmin);
router.put("/admin/:orderId/status", authMiddleware, roleMiddleware("admin"), updateOrderStatus);
router.put("/admin/:orderId/inspection", authMiddleware, roleMiddleware("admin"), updateOrderInspection);
router.put("/admin/:orderId/progress", authMiddleware, roleMiddleware("admin"), updateOrderProgress);
router.post("/admin/:orderId/contract", authMiddleware, roleMiddleware("admin"), generateContract);
router.post("/admin/:orderId/send-approval-email", authMiddleware, roleMiddleware("admin"), sendWalkInApprovalEmail);

export default router;

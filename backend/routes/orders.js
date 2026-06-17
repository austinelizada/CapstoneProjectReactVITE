import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  createOrder,
  createOrderAsAdmin,
  listOrders,
  trackOrder,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
  updateOrderInspection,
  updateOrderProgress,
  generateContract,
  respondToContract,
  respondToInstallationSchedule,
  sendWalkInApprovalEmail,
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/", authMiddleware, listOrders);
router.post("/", authMiddleware, roleMiddleware("customer"), createOrder);
router.get("/track/:tracking", authMiddleware, trackOrder);
router.put("/:orderId/contract", authMiddleware, roleMiddleware("customer"), respondToContract);
router.put("/:orderId/installation-schedule", authMiddleware, respondToInstallationSchedule);

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

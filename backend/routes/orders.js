import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { 
  createOrder, 
  createOrderAsAdmin,
  listOrders, 
  trackOrder, 
  getAdminOrders,
  updateOrderStatus,
  updateOrderInspection,
  generateContract 
} from "../controllers/orderController.js";

const router = express.Router();

router.get("/", authMiddleware, listOrders);
router.post("/", authMiddleware, roleMiddleware("customer"), createOrder);
router.get("/track/:tracking", authMiddleware, trackOrder);

// Admin routes
router.get("/admin/list", authMiddleware, roleMiddleware("admin"), getAdminOrders);
router.post("/admin/create", authMiddleware, roleMiddleware("admin"), createOrderAsAdmin);
router.put("/admin/:orderId/status", authMiddleware, roleMiddleware("admin"), updateOrderStatus);
router.put("/admin/:orderId/inspection", authMiddleware, roleMiddleware("admin"), updateOrderInspection);
router.post("/admin/:orderId/contract", authMiddleware, roleMiddleware("admin"), generateContract);

export default router;

import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getCart, saveCart } from "../controllers/cartController.js";

const router = express.Router();

router.get("/", authMiddleware, roleMiddleware("customer"), getCart);
router.put("/", authMiddleware, roleMiddleware("customer"), saveCart);

export default router;
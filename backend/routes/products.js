import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

const router = express.Router();

router.get("/", listProducts);
router.get("/:id", authMiddleware, getProduct);
// Allow unauthenticated product creation for local testing (remove authMiddleware in prod)
router.post("/", createProduct);
router.put("/:id", authMiddleware, updateProduct);
router.delete("/:id", authMiddleware, deleteProduct);

export default router;

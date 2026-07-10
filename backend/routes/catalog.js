import express from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import * as catalogCtrl from "../controllers/catalogController.js";

const router = express.Router();

// Types
router.get("/types", catalogCtrl.getTypes);
router.post("/types", authMiddleware, roleMiddleware("admin"), catalogCtrl.createType);
router.put("/types/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.updateType);
router.delete("/types/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.deleteType);

// Names
router.get("/names", catalogCtrl.getNames);
router.post("/names", authMiddleware, roleMiddleware("admin"), catalogCtrl.createName);
router.put("/names/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.updateName);
router.delete("/names/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.deleteName);

// Variants
router.get("/variants", catalogCtrl.getVariants);
router.post("/variants", authMiddleware, roleMiddleware("admin"), catalogCtrl.createVariant);
router.put("/variants/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.updateVariant);
router.delete("/variants/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.deleteVariant);

// Categories
router.get("/categories", catalogCtrl.getCategories);
router.post("/categories", authMiddleware, roleMiddleware("admin"), catalogCtrl.createCategory);
router.put("/categories/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.updateCategory);
router.delete("/categories/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.deleteCategory);

// Usage check
router.get("/usage/:kind/:id", authMiddleware, roleMiddleware("admin"), catalogCtrl.checkUsage);

export default router;

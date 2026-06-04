import express from "express";
import uploadController, { uploadMiddleware } from "../controllers/uploadController.js";

const router = express.Router();

router.post("/", uploadMiddleware.any(), uploadController.uploadImages);

export default router;

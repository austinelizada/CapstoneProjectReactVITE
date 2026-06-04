import fs from "fs";
import path from "path";
import multer from "multer";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || ".png";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.fieldname}${extension}`;
    cb(null, safeName);
  },
});

export const uploadMiddleware = multer({ storage });

export const uploadImages = async (req, res) => {
  try {
    const { files } = req;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const saved = files.map((file) => ({
      key: file.fieldname,
      url: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
    }));

    res.json({ success: true, files: saved });
  } catch (error) {
    console.error("Upload images error:", error);
    res.status(500).json({ success: false, message: "Unable to upload images", error: error.message });
  }
};

export default { uploadImages, uploadMiddleware };

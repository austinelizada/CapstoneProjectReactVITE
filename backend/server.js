import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import uploadRoutes from "./routes/uploads.js";
import path from "path";
import orderRoutes from "./routes/orders.js";
import { connectMongo } from "./config/db.js";

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/uploads", uploadRoutes);

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Backend is running",
    status: "connected",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const PORT = process.env.PORT || 5000;

connectMongo()
  .then(() => {
    console.log("✓ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`✓ Server listening on http://localhost:${PORT}`);
      console.log(`✓ API base URL: http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error("✗ MongoDB connection error:", error.message);
    process.exit(1);
  });
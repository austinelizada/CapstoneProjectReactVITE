import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import uploadRoutes from "./routes/uploads.js";
import path from "path";
import { fileURLToPath } from "url";
import orderRoutes from "./routes/orders.js";
import { connectMongo } from "./config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });

const requiredEnvs = ["JWT_SECRET"];
for (const envName of requiredEnvs) {
  if (!process.env[envName]) {
    console.error(`✗ Missing required environment variable: ${envName}`);
    process.exit(1);
  }
}

if (!process.env.MONGO_URI) {
  console.warn(
    "[env] MONGO_URI not set. The backend will attempt to connect to local MongoDB at mongodb://127.0.0.1:27017/reactvite"
  );
}

const app = express();

app.use((req, res, next) => {
  console.info(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

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

const getHealthModel = () => {
  const readyStates = [
    "disconnected",
    "connected",
    "connecting",
    "disconnecting",
    "uninitialized",
  ];
  const mongoState = mongoose.connection.readyState;
  const dbConnected = mongoState === 1;
  return {
    status: dbConnected ? "online" : "offline",
    dbConnected,
    databaseState: readyStates[mongoState] || "unknown",
    timestamp: new Date().toISOString(),
    message: dbConnected
      ? "Backend and database are connected"
      : "Backend is running but the database is unavailable",
  };
};

app.get("/", (req, res) => {
  return res.json({ ...getHealthModel(), message: "Backend is running" });
});

app.get("/api/health", (req, res) => {
  return res.json(getHealthModel());
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[error]", err);
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

const PORT = parseInt(process.env.PORT, 10) || 5000;

const shutdown = (reason, error) => {
  console.error(`✗ Shutdown: ${reason}`);
  if (error) {
    console.error(error);
  }
  process.exit(1);
};

connectMongo()
  .then(() => {
    console.log("✓ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`✓ Server listening on http://localhost:${PORT}`);
      console.log(`✓ API base URL: http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    shutdown("MongoDB connection error", error);
  });

process.on("uncaughtException", (error) => {
  shutdown("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  shutdown("Unhandled promise rejection", reason instanceof Error ? reason : new Error(String(reason)));
});

process.on("SIGINT", () => {
  console.log("✱ Received SIGINT, shutting down gracefully.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("✱ Received SIGTERM, shutting down gracefully.");
  process.exit(0);
});
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/order.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminOrdersRoutes from "./routes/adminOrders.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import orderManagementRoutes from "./routes/orderManagement.routes.js";
import userManagementRoutes from "./routes/userManagement.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import bannerRoutes from "./routes/banner.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import blogRoutes from "./routes/blog.routes.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "https://urban-hub-frontend.vercel.app"],
    credentials: true,
  })
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Urban Hub API is running...",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/auth", authRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/admin", adminRoutes);
app.use("/admin/orders", adminOrdersRoutes);
app.use("/admin/coupons", couponRoutes);
app.use("/admin/orders-legacy", orderManagementRoutes);
app.use("/admin/users", userManagementRoutes);
app.use("/admin/invoices", invoiceRoutes);
app.use("/banners", bannerRoutes);
app.use("/cart", cartRoutes);
app.use("/blogs", blogRoutes);

// 404 handler - catch all undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Server configuration
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\nSIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

import express from "express";
import {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getDevices,
  getDeviceById,
  updateDevice,
  generateReport,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from "../controllers/admin.controller.js";

import {
  getOrdersAnalytics,
  getUsersAnalytics,
} from "../controllers/analytics.controller.js";

import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth, role(["admin"]));

// Dashboard
router.get("/dashboard/stats", getDashboardStats);

// Users Management
router.get("/users", getUsers);
router.get("/users/analytics", getUsersAnalytics);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.patch("/users/:id/toggle-status", toggleUserStatus);

// Products Management
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Orders Management
router.get("/orders", getOrders);
router.get("/orders/analytics", getOrdersAnalytics);
router.get("/orders/:id", getOrderById);
router.patch("/orders/:id/status", updateOrderStatus);

// Devices Management
router.get("/devices", getDevices);
router.get("/devices/:id", getDeviceById);
router.put("/devices/:id", updateDevice);

// Reports
router.post("/reports/:type", generateReport);

// Admin Profile
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);
router.patch("/change-password", changeAdminPassword);

export default router;

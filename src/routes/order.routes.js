import express from "express";
import {
  createOrder,
  getAllOrders,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getOrderStats,
} from "../controllers/order.controller.js";

import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// User Routes
router.post("/", auth, createOrder);
router.get("/my-orders", auth, getUserOrders);
router.get("/:id", auth, getOrderById);
router.put("/:id/cancel", auth, cancelOrder);

// Admin Routes
router.get("/", auth, role(["admin"]), getAllOrders);
router.put("/:id/status", auth, role(["admin"]), updateOrderStatus);
router.get("/admin/stats", auth, role(["admin"]), getOrderStats);

export default router;

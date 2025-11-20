import express from "express";
import {
  getAllAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
  getAdminOrderStats,
} from "../controllers/adminOrders.controller.js";

import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// All admin order routes require authentication and admin role
router.use(auth, role(["admin"]));

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders with filtering, sorting, and pagination
 * @access  Admin only
 * @params  page, limit, search, status, paymentStatus, fulfillmentStatus,
 *          paymentMethod, dateFrom, dateTo, sortBy, sortOrder, minAmount, maxAmount, archived
 */
router.get("/", getAllAdminOrders);

/**
 * @route   GET /api/admin/orders/stats
 * @desc    Get order statistics for dashboard
 * @access  Admin only
 * @params  period (days, default: 30)
 */
router.get("/stats", getAdminOrderStats);

/**
 * @route   GET /api/admin/orders/:orderId
 * @desc    Get single order details by ID
 * @access  Admin only
 */
router.get("/:orderId", getAdminOrderById);

/**
 * @route   PATCH /api/admin/orders/:orderId/status
 * @desc    Update order status
 * @access  Admin only
 * @body    { status, note?, trackingNumber?, estimatedDelivery? }
 */
router.patch("/:orderId/status", updateAdminOrderStatus);

export default router;

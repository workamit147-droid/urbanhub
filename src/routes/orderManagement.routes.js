import express from "express";
import {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateFulfillment,
  addOrderNote,
  recordRefund,
  bulkOrderActions,
  downloadExport,
  getOrderAnalytics,
} from "../controllers/orderManagement.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import adminRoleMiddleware from "../middlewares/role.middleware.js";

const router = express.Router();

// Apply auth and admin role middleware to all routes
router.use(authMiddleware);
router.use(adminRoleMiddleware);

// Order analytics
router.get("/analytics", getOrderAnalytics);

// Order list with advanced filtering
router.get("/", getAllOrders);

// Bulk operations
router.post("/bulk", bulkOrderActions);

// Download export
router.get("/download/:filename", downloadExport);

// Single order operations
router.get("/:orderId", getOrderById);
router.put("/:orderId/status", updateOrderStatus);
router.put("/:orderId/fulfillment", updateFulfillment);
router.post("/:orderId/notes", addOrderNote);
router.post("/:orderId/refund", recordRefund);

export default router;

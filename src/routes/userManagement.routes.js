import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserBlock,
  resetUserPassword,
  impersonateUser,
  addUserNote,
  bulkUserActions,
  downloadExport,
  getUserAnalytics,
} from "../controllers/userManagement.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// Apply auth and admin role middleware to all routes
router.use(authMiddleware);
router.use(role(["admin"]));

// User analytics
router.get("/analytics", getUserAnalytics);

// User list with filtering
router.get("/", getAllUsers);

// Bulk operations
router.post("/bulk", bulkUserActions);

// Download export
router.get("/download/:filename", downloadExport);

// Single user operations
router.get("/:userId", getUserById);
router.put("/:userId", updateUser);
router.put("/:userId/block", toggleUserBlock);
router.post("/:userId/reset-password", resetUserPassword);
router.post("/:userId/impersonate", impersonateUser);
router.post("/:userId/notes", addUserNote);

export default router;

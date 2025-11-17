import express from "express";
import {
  register,
  login,
  logout,
  refresh,
  getProfile,
  updateProfile,
  changePassword,
  validateToken,
} from "../controllers/auth.controller.js";

import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// Public Routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// Protected routes
router.post("/logout", auth, logout);
router.get("/validate", auth, validateToken);
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);

// Admin-only example
router.get("/admin-only", auth, role(["admin"]), (req, res) => {
  res.json({ message: "Admin access granted" });
});

// User-only example
router.get("/user-only", auth, role(["user", "admin"]), (req, res) => {
  res.json({ message: "User access granted" });
});

export default router;

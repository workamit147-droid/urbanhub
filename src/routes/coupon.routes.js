import express from "express";
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  getCouponStats,
} from "../controllers/coupon.controller.js";
import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(auth);

// Apply admin role middleware to all routes
router.use(role(["admin"]));

// GET /admin/coupons/stats - Get coupon statistics
router.get("/stats", getCouponStats);

// POST /admin/coupons - Create new coupon
router.post("/", createCoupon);

// GET /admin/coupons - Get all coupons with filtering/pagination
router.get("/", getAllCoupons);

// GET /admin/coupons/:id - Get single coupon
router.get("/:id", getCouponById);

// PUT /admin/coupons/:id - Update coupon
router.put("/:id", updateCoupon);

// DELETE /admin/coupons/:id - Delete coupon
router.delete("/:id", deleteCoupon);

export default router;

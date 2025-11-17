import express from "express";
import {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  mergeCart,
  applyCoupon,
  removeCoupon,
} from "../controllers/cart.controller.js";
import auth from "../middlewares/auth.middleware.js";

const router = express.Router();

// Optional auth middleware for cart (supports both logged-in users and guests)
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    try {
      const jwt = await import("jsonwebtoken");
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Invalid token, continue as guest
      req.user = null;
    }
  }

  next();
};

// GET /cart - Get current cart
router.get("/", optionalAuth, getCart);

// POST /cart/add - Add item to cart
router.post("/add", optionalAuth, addToCart);

// PUT /cart/item/:itemId - Update cart item quantity
router.put("/item/:itemId", optionalAuth, updateCartItem);

// DELETE /cart/item/:itemId - Remove item from cart
router.delete("/item/:itemId", optionalAuth, removeCartItem);

// POST /cart/clear - Clear entire cart
router.post("/clear", optionalAuth, clearCart);

// POST /cart/merge - Merge guest cart with user cart (requires auth)
router.post("/merge", auth, mergeCart);

// POST /cart/apply-coupon - Apply coupon to cart
router.post("/apply-coupon", optionalAuth, applyCoupon);

// POST /cart/remove-coupon - Remove coupon from cart
router.post("/remove-coupon", optionalAuth, removeCoupon);

export default router;

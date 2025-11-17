import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  getProductsBySeller,
  getCategories,
  searchProducts,
  uploadImage,
} from "../controllers/product.controller.js";

import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";
import { upload } from "../utils/imagekit.js";

const router = express.Router();

// Public Routes
router.get("/", getAllProducts);
router.get("/categories", getCategories);
router.get("/search", searchProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);

// Seller Routes (Authenticated sellers can manage their products)
router.post("/", auth, role(["admin", "seller"]), createProduct);
router.post(
  "/upload-image",
  auth,
  role(["admin", "seller"]),
  upload.single("image"),
  uploadImage
);
router.get("/seller/:sellerId", auth, getProductsBySeller);
router.put("/:id", auth, role(["admin", "seller"]), updateProduct);
router.delete("/:id", auth, role(["admin", "seller"]), deleteProduct);

export default router;

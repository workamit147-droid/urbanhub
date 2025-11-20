import express from "express";
import {
  getAllBlogs,
  getBlogBySlug,
  getFeaturedBlogs,
  getRelatedBlogs,
  adminGetAllBlogs,
  adminGetBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogStats,
} from "../controllers/blog.controller.js";
import auth from "../middlewares/auth.middleware.js";
import adminAuth from "../middlewares/adminAuth.middleware.js";

const router = express.Router();

// PUBLIC ROUTES
router.get("/", getAllBlogs);
router.get("/featured", getFeaturedBlogs);
router.get("/:slug", getBlogBySlug);
router.get("/:slug/related", getRelatedBlogs);

// ADMIN ROUTES
router.get("/admin/all", auth, adminAuth, adminGetAllBlogs);
router.get("/admin/stats", auth, adminAuth, getBlogStats);
router.get("/admin/:id", auth, adminAuth, adminGetBlogById);
router.post("/admin/create", auth, adminAuth, createBlog);
router.put("/admin/:id", auth, adminAuth, updateBlog);
router.delete("/admin/:id", auth, adminAuth, deleteBlog);

export default router;

import express from "express";
import multer from "multer";
import {
  uploadBannerImage,
  createBanner,
  getBanners,
  getActiveBanners,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} from "../controllers/banner.controller.js";
import auth from "../middlewares/auth.middleware.js";
import role from "../middlewares/role.middleware.js";

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Public routes
router.get("/active", getActiveBanners);

// Protected routes (Admin only)
router.use(auth);
router.use(role(["admin"]));

// Banner management routes
router.post("/upload-image", upload.single("image"), uploadBannerImage);
router.post("/", createBanner);
router.get("/", getBanners);
router.put("/:id", updateBanner);
router.delete("/:id", deleteBanner);
router.patch("/:id/toggle-status", toggleBannerStatus);

export default router;

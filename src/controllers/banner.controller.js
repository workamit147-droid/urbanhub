import Banner from "../models/banner.model.js";
import { imagekit } from "../utils/imagekit.js";

// UPLOAD BANNER IMAGE
export const uploadBannerImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const file = req.file;
    const fileName = `banner-${Date.now()}-${file.originalname}`;

    const uploadResponse = await imagekit.upload({
      file: file.buffer,
      fileName,
      folder: "/banners",
    });

    res.status(200).json({
      success: true,
      message: "Banner image uploaded successfully",
      image: {
        url: uploadResponse.url,
        fileId: uploadResponse.fileId,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// CREATE BANNER
export const createBanner = async (req, res) => {
  try {
    const banner = await Banner.create(req.body);
    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// GET ALL BANNERS
export const getBanners = async (req, res) => {
  try {
    const { page = 1, limit = 10, activeOnly = false } = req.query;

    const query = activeOnly ? { isActive: true } : {};

    const banners = await Banner.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Banner.countDocuments(query);

    res.json({
      success: true,
      banners,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalBanners: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// GET ACTIVE BANNERS (for frontend - all active banners)
export const getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({
      displayOrder: 1,
      createdAt: -1,
    });

    res.json({
      success: true,
      banners,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// UPDATE BANNER
export const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      message: "Banner updated successfully",
      banner,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// DELETE BANNER
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Optionally delete from ImageKit
    try {
      await imagekit.deleteFile(banner.image.fileId);
    } catch (deleteError) {
      console.warn(
        "Failed to delete image from ImageKit:",
        deleteError.message
      );
    }

    res.json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// TOGGLE BANNER STATUS
export const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.json({
      success: true,
      message: `Banner ${
        banner.isActive ? "activated" : "deactivated"
      } successfully`,
      banner,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

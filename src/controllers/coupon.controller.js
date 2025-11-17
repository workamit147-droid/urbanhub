import Coupon from "../models/coupon.model.js";
import Product from "../models/product.model.js";
import mongoose from "mongoose";

// CREATE COUPON
export const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountType = "percentage",
      discountValue,
      applicableProducts,
      startDate,
      endDate,
      isActive = true,
      maxUsage,
    } = req.body;

    // Validation
    if (
      !code ||
      !discountValue ||
      !applicableProducts ||
      !startDate ||
      !endDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Code, discount value, applicable products, start date, and end date are required",
      });
    }

    // Validate discount value
    if (
      discountType === "percentage" &&
      (discountValue < 1 || discountValue > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 1 and 100",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Validate products exist
    const products = await Product.find({
      _id: { $in: applicableProducts },
      isActive: true,
    });

    if (products.length !== applicableProducts.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected products are invalid or inactive",
      });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      applicableProducts,
      startDate: start,
      endDate: end,
      isActive,
      maxUsage: maxUsage || null,
      createdBy: req.user.id,
    });

    await coupon.save();

    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate("applicableProducts", "title sku price")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon: populatedCoupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: error.message,
    });
  }
};

// GET ALL COUPONS
export const getAllCoupons = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.code = { $regex: search, $options: "i" };
    }

    // Active filter
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [coupons, totalCoupons] = await Promise.all([
      Coupon.find(query)
        .populate("applicableProducts", "title sku price")
        .populate("createdBy", "name email")
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit)),
      Coupon.countDocuments(query),
    ]);

    // Add computed fields
    const enrichedCoupons = coupons.map((coupon) => ({
      ...coupon.toObject(),
      isDateValid: coupon.isDateValid,
      isFullyValid: coupon.isValid(),
      applicableProductCount: coupon.applicableProducts.length,
    }));

    res.json({
      success: true,
      coupons: enrichedCoupons,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCoupons / parseInt(limit)),
        totalCoupons,
        hasNext: skip + parseInt(limit) < totalCoupons,
        hasPrev: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Get coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

// GET SINGLE COUPON
export const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(id)
      .populate("applicableProducts", "title sku price images")
      .populate("createdBy", "name email");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    const enrichedCoupon = {
      ...coupon.toObject(),
      isDateValid: coupon.isDateValid,
      isFullyValid: coupon.isValid(),
      applicableProductCount: coupon.applicableProducts.length,
    };

    res.json({
      success: true,
      coupon: enrichedCoupon,
    });
  } catch (error) {
    console.error("Get coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupon",
      error: error.message,
    });
  }
};

// UPDATE COUPON
export const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      discountType,
      discountValue,
      applicableProducts,
      startDate,
      endDate,
      isActive,
      maxUsage,
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Validate discount value if provided
    if (discountValue !== undefined && discountType === "percentage") {
      if (discountValue < 1 || discountValue > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount must be between 1 and 100",
        });
      }
    }

    // Validate dates if provided
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : coupon.startDate;
      const end = endDate ? new Date(endDate) : coupon.endDate;

      if (start >= end) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    // Validate products if provided
    if (applicableProducts) {
      const products = await Product.find({
        _id: { $in: applicableProducts },
        isActive: true,
      });

      if (products.length !== applicableProducts.length) {
        return res.status(400).json({
          success: false,
          message: "One or more selected products are invalid or inactive",
        });
      }
    }

    // Check if code already exists (if changing code)
    if (code && code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
    }

    // Update fields
    const updateData = {};
    if (code !== undefined) updateData.code = code.toUpperCase();
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue;
    if (applicableProducts !== undefined)
      updateData.applicableProducts = applicableProducts;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (maxUsage !== undefined) updateData.maxUsage = maxUsage || null;

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("applicableProducts", "title sku price")
      .populate("createdBy", "name email");

    res.json({
      success: true,
      message: "Coupon updated successfully",
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: error.message,
    });
  }
};

// DELETE COUPON
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    await Coupon.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: error.message,
    });
  }
};

// GET COUPON STATISTICS
export const getCouponStats = async (req, res) => {
  try {
    const [totalCoupons, activeCoupons, expiredCoupons, upcomingCoupons] =
      await Promise.all([
        Coupon.countDocuments({}),
        Coupon.countDocuments({ isActive: true }),
        Coupon.countDocuments({
          endDate: { $lt: new Date() },
        }),
        Coupon.countDocuments({
          startDate: { $gt: new Date() },
        }),
      ]);

    res.json({
      success: true,
      stats: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        upcomingCoupons,
        inactiveCoupons: totalCoupons - activeCoupons,
      },
    });
  } catch (error) {
    console.error("Get coupon stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupon statistics",
      error: error.message,
    });
  }
};

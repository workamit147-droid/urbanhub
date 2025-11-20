import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import mongoose from "mongoose";

/**
 * Get all orders for admin dashboard
 * Supports comprehensive filtering, sorting, and pagination
 * Includes full order details with populated customer and product info
 */
export const getAllAdminOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      paymentStatus = "",
      fulfillmentStatus = "",
      paymentMethod = "",
      dateFrom = "",
      dateTo = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      minAmount = "",
      maxAmount = "",
      archived = false,
    } = req.query;

    // Build query conditions
    const queryConditions = [];

    // Archived filter
    queryConditions.push({ isArchived: archived === "true" });

    // Search across multiple fields
    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      queryConditions.push({
        $or: [
          { orderId: searchRegex },
          { orderNumber: searchRegex },
          { "shippingAddress.fullName": searchRegex },
          { "shippingAddress.email": searchRegex },
          { "shippingAddress.phone": searchRegex },
          { "items.title": searchRegex },
        ],
      });
    }

    // Status filters
    if (status && status !== "all") {
      queryConditions.push({ status });
    }

    if (paymentStatus && paymentStatus !== "all") {
      queryConditions.push({
        $or: [
          { "payment.status": paymentStatus },
          { paymentStatus: paymentStatus }, // Legacy support
        ],
      });
    }

    if (fulfillmentStatus && fulfillmentStatus !== "all") {
      queryConditions.push({ "fulfillment.status": fulfillmentStatus });
    }

    if (paymentMethod && paymentMethod !== "all") {
      queryConditions.push({
        $or: [
          { "payment.method": paymentMethod },
          { paymentMethod: paymentMethod }, // Legacy support
        ],
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateFilter = {};
      if (dateFrom) {
        dateFilter.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Include the entire day for dateTo
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      queryConditions.push({ createdAt: dateFilter });
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      const amountFilter = {};
      if (minAmount && !isNaN(parseFloat(minAmount))) {
        amountFilter.$gte = parseFloat(minAmount);
      }
      if (maxAmount && !isNaN(parseFloat(maxAmount))) {
        amountFilter.$lte = parseFloat(maxAmount);
      }
      queryConditions.push({ totalAmount: amountFilter });
    }

    // Combine all conditions
    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute queries in parallel for better performance
    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .populate({
          path: "customerId",
          select: "name email phone avatar createdAt",
          model: "User",
        })
        .populate({
          path: "items.productId",
          select: "title slug images price categories stock",
          model: "Product",
        })
        .sort(sortConfig)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean for better performance
      Order.countDocuments(query),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Get summary statistics for current filters
    const summaryStats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          avgOrderValue: { $avg: "$totalAmount" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "shipped"] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = summaryStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    };

    // Format response
    const response = {
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          startIndex: skip + 1,
          endIndex: Math.min(skip + limitNum, totalCount),
        },
        filters: {
          search,
          status,
          paymentStatus,
          fulfillmentStatus,
          paymentMethod,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder,
          minAmount,
          maxAmount,
          archived,
        },
        stats,
      },
      message: "Orders retrieved successfully",
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get single order details by ID
 */
export const getAdminOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    const order = await Order.findById(orderId)
      .populate({
        path: "customerId",
        select: "name email phone avatar createdAt role",
        model: "User",
      })
      .populate({
        path: "items.productId",
        select:
          "title slug images price categories stock attributes dimensions",
        model: "Product",
      })
      .populate({
        path: "coupon.couponId",
        select: "code type value validFrom validTo",
        model: "Coupon",
      })
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get related orders from the same customer
    const relatedOrders = await Order.find({
      customerId: order.customerId._id,
      _id: { $ne: order._id },
    })
      .select("orderId status totalAmount createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        order,
        relatedOrders,
      },
      message: "Order details retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update order status
 */
export const updateAdminOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, trackingNumber, estimatedDelivery } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // Validate status
    const validStatuses = [
      "pending",
      "confirmed",
      "packed",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
      "refunded",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order status using the model method
    order.updateStatus(status, req.user.id, req.user.name, note);

    // Update fulfillment details if provided
    if (trackingNumber) {
      order.fulfillment.trackingNumber = trackingNumber;
    }

    if (estimatedDelivery) {
      order.fulfillment.eta = new Date(estimatedDelivery);
    }

    await order.save();

    // Populate the updated order for response
    const updatedOrder = await Order.findById(orderId)
      .populate("customerId", "name email phone")
      .populate("items.productId", "title slug images");

    res.status(200).json({
      success: true,
      data: updatedOrder,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get order statistics for dashboard
 */
export const getAdminOrderStats = async (req, res) => {
  try {
    const { period = "30" } = req.query;
    const days = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await Order.aggregate([
      {
        $facet: {
          // Overall stats
          overall: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" },
                avgOrderValue: { $avg: "$totalAmount" },
              },
            },
          ],
          // Recent stats (based on period)
          recent: [
            { $match: { createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: null,
                recentOrders: { $sum: 1 },
                recentRevenue: { $sum: "$totalAmount" },
              },
            },
          ],
          // Status breakdown
          statusBreakdown: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                revenue: { $sum: "$totalAmount" },
              },
            },
          ],
          // Daily trends for the period
          dailyTrends: [
            { $match: { createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                orders: { $sum: 1 },
                revenue: { $sum: "$totalAmount" },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const result = stats[0];

    res.status(200).json({
      success: true,
      data: {
        overall: result.overall[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
        },
        recent: result.recent[0] || { recentOrders: 0, recentRevenue: 0 },
        statusBreakdown: result.statusBreakdown,
        dailyTrends: result.dailyTrends,
        period: days,
      },
      message: "Order statistics retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching order statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

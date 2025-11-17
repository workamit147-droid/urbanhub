import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import { createObjectCsvWriter } from "csv-writer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all orders with advanced filtering and pagination
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q = "",
      status,
      paymentStatus,
      fulfillmentStatus,
      dateFrom,
      dateTo,
      paymentMethod,
      minAmount,
      maxAmount,
      trackingNumber,
      orderId,
      customerEmail,
      customerPhone,
      archived,
    } = req.query;

    // Build search query
    const searchQuery = { isArchived: archived === "true" };

    // Text search across multiple fields
    if (q) {
      const searchRegex = new RegExp(q, "i");
      searchQuery.$or = [
        { orderId: searchRegex },
        { orderNumber: searchRegex },
        { "shippingAddress.fullName": searchRegex },
        { "shippingAddress.email": searchRegex },
        { "shippingAddress.phone": searchRegex },
        { "items.title": searchRegex },
        { "items.sku": searchRegex },
      ];
    }

    // Specific field searches
    if (orderId) searchQuery.orderId = new RegExp(orderId, "i");
    if (customerEmail)
      searchQuery["shippingAddress.email"] = new RegExp(customerEmail, "i");
    if (customerPhone)
      searchQuery["shippingAddress.phone"] = new RegExp(customerPhone, "i");
    if (trackingNumber) {
      searchQuery.$or = [
        { "fulfillment.trackingNumber": new RegExp(trackingNumber, "i") },
        { trackingNumber: new RegExp(trackingNumber, "i") }, // Legacy field
      ];
    }

    // Status filters
    if (status) searchQuery.status = status;
    if (paymentStatus) {
      searchQuery.$or = [
        { "payment.status": paymentStatus },
        { paymentStatus: paymentStatus }, // Legacy field
      ];
    }
    if (fulfillmentStatus)
      searchQuery["fulfillment.status"] = fulfillmentStatus;
    if (paymentMethod) {
      searchQuery.$or = [
        { "payment.method": paymentMethod },
        { paymentMethod: paymentMethod }, // Legacy field
      ];
    }

    // Date range filter
    if (dateFrom || dateTo) {
      searchQuery.createdAt = {};
      if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      searchQuery.totalAmount = {};
      if (minAmount) searchQuery.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount) searchQuery.totalAmount.$lte = parseFloat(maxAmount);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Parse sort parameter
    const sortObject = {};
    const sortFields = sort.split(",");
    sortFields.forEach((field) => {
      if (field.startsWith("-")) {
        sortObject[field.substring(1)] = -1;
      } else {
        sortObject[field] = 1;
      }
    });

    // Execute query with population
    const [orders, total] = await Promise.all([
      Order.find(searchQuery)
        .populate("customerId", "name email phone")
        .populate("items.productId", "title slug sku")
        .sort(sortObject)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(searchQuery),
    ]);

    // Calculate pagination info
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages,
          hasNext: parseInt(page) < pages,
          hasPrev: parseInt(page) > 1,
        },
        filters: {
          q,
          status,
          paymentStatus,
          fulfillmentStatus,
          dateFrom,
          dateTo,
          paymentMethod,
          minAmount,
          maxAmount,
          archived,
        },
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// Get single order details
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate(
        "customerId",
        "name email phone totalSpent totalOrders addresses"
      )
      .populate("items.productId", "title slug sku hsn images")
      .populate("notes.internal.adminId", "name")
      .populate("notes.public.adminId", "name")
      .populate("audit.byAdminId", "name")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note, notifyCustomer = false } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

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
        message: "Invalid status",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update status with audit trail
    order.updateStatus(status, adminId, adminName, note);

    await order.save();

    // TODO: Send notification to customer if notifyCustomer is true

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        orderId: order._id,
        status: order.status,
        fulfillmentStatus: order.fulfillment.status,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// Update fulfillment details
export const updateFulfillment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { carrier, trackingNumber, eta, shippedAt, deliveredAt } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update fulfillment details
    if (carrier !== undefined) order.fulfillment.carrier = carrier;
    if (trackingNumber !== undefined) {
      order.fulfillment.trackingNumber = trackingNumber;
      order.trackingNumber = trackingNumber; // Legacy field
    }
    if (eta !== undefined) order.fulfillment.eta = new Date(eta);
    if (shippedAt !== undefined) {
      order.fulfillment.shippedAt = new Date(shippedAt);
      if (order.status === "confirmed" || order.status === "packed") {
        order.updateStatus(
          "shipped",
          adminId,
          adminName,
          "Fulfillment details updated"
        );
      }
    }
    if (deliveredAt !== undefined) {
      order.fulfillment.deliveredAt = new Date(deliveredAt);
      order.deliveredAt = new Date(deliveredAt); // Legacy field
      if (order.status !== "delivered") {
        order.updateStatus("delivered", adminId, adminName, "Order delivered");
      }
    }

    // Add audit log for fulfillment update
    order.addAuditLog(
      "Fulfillment updated",
      adminId,
      adminName,
      null,
      null,
      "Tracking and delivery details updated"
    );

    await order.save();

    res.json({
      success: true,
      message: "Fulfillment details updated successfully",
      data: {
        fulfillment: order.fulfillment,
      },
    });
  } catch (error) {
    console.error("Update fulfillment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update fulfillment details",
      error: error.message,
    });
  }
};

// Add note to order
export const addOrderNote = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { text, type = "internal" } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Note text is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Add note
    order.addNote(text.trim(), adminId, adminName, type);

    await order.save();

    res.json({
      success: true,
      message: `${
        type === "internal" ? "Internal" : "Public"
      } note added successfully`,
      data: {
        note: {
          text: text.trim(),
          type,
          adminName,
          createdAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Add order note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: error.message,
    });
  }
};

// Record refund
export const recordRefund = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, reason, type = "partial" } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid refund amount is required",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Validate refund amount
    const maxRefund = order.totalAmount - (order.payment.refundAmount || 0);
    if (amount > maxRefund) {
      return res.status(400).json({
        success: false,
        message: `Refund amount cannot exceed ${maxRefund}`,
      });
    }

    // Update payment details
    order.payment.refundAmount = (order.payment.refundAmount || 0) + amount;
    order.payment.refundReason = reason || "Refund processed";
    order.payment.refundType = type;
    order.payment.refundedAt = new Date();

    // Update payment status
    if (order.payment.refundAmount >= order.totalAmount) {
      order.payment.status = "refunded";
      if (order.status !== "refunded") {
        order.updateStatus(
          "refunded",
          adminId,
          adminName,
          `Full refund of ₹${amount} processed`
        );
      }
    } else {
      order.payment.status = "partially_refunded";
    }

    // Add audit log
    order.addAuditLog(
      "Refund processed",
      adminId,
      adminName,
      null,
      null,
      `${type} refund of ₹${amount}: ${reason}`
    );

    await order.save();

    res.json({
      success: true,
      message: "Refund recorded successfully",
      data: {
        refundAmount: order.payment.refundAmount,
        paymentStatus: order.payment.status,
        totalRefunded: order.payment.refundAmount,
        remainingAmount: order.totalAmount - order.payment.refundAmount,
      },
    });
  } catch (error) {
    console.error("Record refund error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record refund",
      error: error.message,
    });
  }
};

// Bulk operations on orders
export const bulkOrderActions = async (req, res) => {
  try {
    const { orderIds, action, data = {} } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order IDs array is required",
      });
    }

    const validActions = ["updateStatus", "archive", "unarchive", "export"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bulk action",
      });
    }

    let result = { success: 0, failed: 0, errors: [] };

    switch (action) {
      case "updateStatus":
        const { status } = data;
        if (!status) {
          return res.status(400).json({
            success: false,
            message: "Status is required for updateStatus action",
          });
        }

        for (const orderId of orderIds) {
          try {
            const order = await Order.findById(orderId);
            if (order) {
              order.updateStatus(
                status,
                adminId,
                adminName,
                `Bulk status update to ${status}`
              );
              await order.save();
              result.success++;
            } else {
              result.failed++;
              result.errors.push(`Order ${orderId} not found`);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to update ${orderId}: ${error.message}`);
          }
        }
        break;

      case "archive":
        try {
          const updateResult = await Order.updateMany(
            { _id: { $in: orderIds } },
            {
              $set: { isArchived: true },
              $push: {
                audit: {
                  action: "Archived",
                  byAdminId: adminId,
                  byAdminName: adminName,
                  note: "Bulk archive operation",
                },
              },
            }
          );
          result.success = updateResult.modifiedCount;
          result.failed = orderIds.length - updateResult.modifiedCount;
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: "Failed to archive orders",
            error: error.message,
          });
        }
        break;

      case "unarchive":
        try {
          const updateResult = await Order.updateMany(
            { _id: { $in: orderIds } },
            {
              $set: { isArchived: false },
              $push: {
                audit: {
                  action: "Unarchived",
                  byAdminId: adminId,
                  byAdminName: adminName,
                  note: "Bulk unarchive operation",
                },
              },
            }
          );
          result.success = updateResult.modifiedCount;
          result.failed = orderIds.length - updateResult.modifiedCount;
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: "Failed to unarchive orders",
            error: error.message,
          });
        }
        break;

      case "export":
        try {
          const orders = await Order.find({ _id: { $in: orderIds } })
            .populate("customerId", "name email phone")
            .lean();

          const csvData = orders.map((order) => ({
            OrderID: order.orderId,
            OrderNumber: order.orderNumber,
            Customer: order.customerId?.name || "Guest",
            Email: order.customerId?.email || order.shippingAddress?.email,
            Status: order.status,
            PaymentStatus: order.payment?.status || order.paymentStatus,
            Total: order.totalAmount,
            Currency: order.currency,
            CreatedAt: order.createdAt,
            ShippingAddress: `${order.shippingAddress?.addressLine1}, ${order.shippingAddress?.city}`,
          }));

          const filename = `orders-export-${Date.now()}.csv`;
          const filepath = path.join(__dirname, "../../exports", filename);

          // Ensure exports directory exists
          const exportsDir = path.dirname(filepath);
          if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
          }

          const csvWriter = createObjectCsvWriter({
            path: filepath,
            header: [
              { id: "OrderID", title: "Order ID" },
              { id: "OrderNumber", title: "Order Number" },
              { id: "Customer", title: "Customer" },
              { id: "Email", title: "Email" },
              { id: "Status", title: "Status" },
              { id: "PaymentStatus", title: "Payment Status" },
              { id: "Total", title: "Total" },
              { id: "Currency", title: "Currency" },
              { id: "CreatedAt", title: "Created At" },
              { id: "ShippingAddress", title: "Shipping Address" },
            ],
          });

          await csvWriter.writeRecords(csvData);

          result.success = orders.length;
          result.exportFile = filename;
          result.downloadUrl = `/api/admin/orders/download/${filename}`;
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: "Failed to export orders",
            error: error.message,
          });
        }
        break;
    }

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      data: result,
    });
  } catch (error) {
    console.error("Bulk order action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk action",
      error: error.message,
    });
  }
};

// Download exported CSV file
export const downloadExport = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filepath = path.join(__dirname, "../../exports", sanitizedFilename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: "Export file not found",
      });
    }

    res.download(filepath, sanitizedFilename, (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({
          success: false,
          message: "Failed to download file",
        });
      }

      // Delete file after download
      setTimeout(() => {
        fs.unlink(filepath, (unlinkErr) => {
          if (unlinkErr)
            console.error("Failed to delete export file:", unlinkErr);
        });
      }, 5000);
    });
  } catch (error) {
    console.error("Download export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download export",
      error: error.message,
    });
  }
};

// Get order analytics
export const getOrderAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const matchQuery = { isArchived: { $ne: true } };
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
    }

    const analytics = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          avgOrderValue: { $avg: "$totalAmount" },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    const statusBreakdown = await Order.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const paymentStatusBreakdown = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $ifNull: ["$payment.status", "$paymentStatus"] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          pendingOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
        },
        statusBreakdown,
        paymentStatusBreakdown,
      },
    });
  } catch (error) {
    console.error("Get order analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order analytics",
      error: error.message,
    });
  }
};

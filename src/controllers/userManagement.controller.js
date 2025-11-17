import User from "../models/user.model.js";
import Order from "../models/order.model.js";
import jwt from "jsonwebtoken";
import { createObjectCsvWriter } from "csv-writer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all users with filtering and pagination
export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q = "",
      role,
      status,
      dateFrom,
      dateTo,
      blocked,
      minSpent,
      maxSpent,
    } = req.query;

    // Build search query
    const searchQuery = { isDeleted: { $ne: true } };

    // Text search
    if (q) {
      const searchRegex = new RegExp(q, "i");
      searchQuery.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Filters
    if (role) searchQuery.role = role;
    if (status !== undefined) searchQuery.isActive = status === "active";
    if (blocked !== undefined) searchQuery.isBlocked = blocked === "true";

    // Date range filter
    if (dateFrom || dateTo) {
      searchQuery.createdAt = {};
      if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
    }

    // Spending range filter
    if (minSpent || maxSpent) {
      searchQuery.totalSpent = {};
      if (minSpent) searchQuery.totalSpent.$gte = parseFloat(minSpent);
      if (maxSpent) searchQuery.totalSpent.$lte = parseFloat(maxSpent);
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

    // Execute query
    const [users, total] = await Promise.all([
      User.find(searchQuery)
        .select(
          "-password -refreshToken -temporaryPassword -passwordResetToken"
        )
        .sort(sortObject)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(searchQuery),
    ]);

    // Calculate pagination info
    const pages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
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
          role,
          status,
          blocked,
          dateFrom,
          dateTo,
          minSpent,
          maxSpent,
        },
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// Get single user details with order history
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const { orderPage = 1, orderLimit = 10 } = req.query;

    const user = await User.findById(userId)
      .select("-password -refreshToken -temporaryPassword")
      .populate("adminNotes.adminId", "name")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user's order history with pagination
    const orderSkip = (parseInt(orderPage) - 1) * parseInt(orderLimit);
    const [orders, totalOrders] = await Promise.all([
      Order.find({ customerId: userId, isArchived: { $ne: true } })
        .select(
          "orderId orderNumber status totalAmount createdAt payment.status fulfillment.status"
        )
        .sort({ createdAt: -1 })
        .skip(orderSkip)
        .limit(parseInt(orderLimit))
        .lean(),
      Order.countDocuments({ customerId: userId, isArchived: { $ne: true } }),
    ]);

    // Calculate order statistics
    const orderStats = await Order.aggregate([
      { $match: { customerId: user._id, isArchived: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
          avgOrderValue: { $avg: "$totalAmount" },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      completedOrders: 0,
      cancelledOrders: 0,
    };

    res.json({
      success: true,
      data: {
        user,
        orders: {
          data: orders,
          pagination: {
            page: parseInt(orderPage),
            limit: parseInt(orderLimit),
            total: totalOrders,
            pages: Math.ceil(totalOrders / parseInt(orderLimit)),
          },
        },
        stats,
      },
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user details",
      error: error.message,
    });
  }
};

// Update user profile and permissions
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, role, isActive, dateOfBirth } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from changing their own role
    if (userId === adminId && role && role !== user.role) {
      return res.status(403).json({
        success: false,
        message: "Cannot change your own role",
      });
    }

    // Check if email is already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Update fields
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;

    // Add admin note for the update
    const updateNote = `Profile updated by ${adminName}. Changes: ${Object.keys(
      updates
    ).join(", ")}`;
    user.addAdminNote(updateNote, adminId, adminName);

    Object.assign(user, updates);
    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

// Block or unblock user
export const toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked, reason } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from blocking themselves
    if (userId === adminId) {
      return res.status(403).json({
        success: false,
        message: "Cannot block yourself",
      });
    }

    if (isBlocked) {
      user.blockUser(adminId, reason || "Blocked by admin");
      user.addAdminNote(
        `User blocked by ${adminName}. Reason: ${
          reason || "No reason provided"
        }`,
        adminId,
        adminName
      );
    } else {
      user.unblockUser();
      user.addAdminNote(`User unblocked by ${adminName}`, adminId, adminName);
    }

    await user.save();

    res.json({
      success: true,
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
      data: {
        userId: user._id,
        isBlocked: user.isBlocked,
        blockedAt: user.blockedAt,
        blockReason: user.blockReason,
      },
    });
  } catch (error) {
    console.error("Toggle user block error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user block status",
      error: error.message,
    });
  }
};

// Reset user password (generate temporary password)
export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notifyUser = true } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate temporary password
    const tempPassword = user.generateTempPassword();

    // Add admin note
    user.addAdminNote(
      `Password reset by ${adminName}. Temporary password generated.`,
      adminId,
      adminName
    );

    await user.save();

    // TODO: Send email with temporary password if notifyUser is true

    res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        userId: user._id,
        temporaryPassword: tempPassword, // In production, this should be sent via email only
        passwordResetRequired: user.passwordResetRequired,
        expiresAt: user.temporaryPasswordExpires,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

// Generate impersonation token
export const impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;
    const adminName = req.user.name;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Cannot impersonate other admins
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot impersonate admin users",
      });
    }

    // Generate impersonation token (short-lived)
    const impersonationToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        impersonatedBy: adminId,
        impersonatedByName: adminName,
        type: "impersonation",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // 1 hour only
    );

    // Log impersonation activity
    user.addAdminNote(`User impersonated by ${adminName}`, adminId, adminName);
    await user.save();

    res.json({
      success: true,
      message: "Impersonation token generated",
      data: {
        impersonationToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        expiresIn: "1h",
        impersonatedBy: adminName,
      },
    });
  } catch (error) {
    console.error("Impersonate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate impersonation token",
      error: error.message,
    });
  }
};

// Add admin note to user
export const addUserNote = async (req, res) => {
  try {
    const { userId } = req.params;
    const { note } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.addAdminNote(note.trim(), adminId, adminName);
    await user.save();

    res.json({
      success: true,
      message: "Note added successfully",
      data: {
        note: {
          note: note.trim(),
          adminName,
          createdAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Add user note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: error.message,
    });
  }
};

// Bulk user operations
export const bulkUserActions = async (req, res) => {
  try {
    const { userIds, action, data = {} } = req.body;
    const adminId = req.user.id;
    const adminName = req.user.name;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    // Prevent admin from performing bulk actions on themselves
    if (userIds.includes(adminId)) {
      return res.status(403).json({
        success: false,
        message: "Cannot perform bulk actions on yourself",
      });
    }

    const validActions = ["block", "unblock", "changeRole", "delete", "export"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bulk action",
      });
    }

    let result = { success: 0, failed: 0, errors: [] };

    switch (action) {
      case "block":
        const { reason } = data;
        for (const userId of userIds) {
          try {
            const user = await User.findById(userId);
            if (user && user.role !== "admin") {
              user.blockUser(adminId, reason || "Bulk block operation");
              user.addAdminNote(
                `Bulk blocked by ${adminName}`,
                adminId,
                adminName
              );
              await user.save();
              result.success++;
            } else if (user && user.role === "admin") {
              result.failed++;
              result.errors.push(`Cannot block admin user ${userId}`);
            } else {
              result.failed++;
              result.errors.push(`User ${userId} not found`);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to block ${userId}: ${error.message}`);
          }
        }
        break;

      case "unblock":
        for (const userId of userIds) {
          try {
            const user = await User.findById(userId);
            if (user) {
              user.unblockUser();
              user.addAdminNote(
                `Bulk unblocked by ${adminName}`,
                adminId,
                adminName
              );
              await user.save();
              result.success++;
            } else {
              result.failed++;
              result.errors.push(`User ${userId} not found`);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to unblock ${userId}: ${error.message}`);
          }
        }
        break;

      case "changeRole":
        const { role } = data;
        if (!role) {
          return res.status(400).json({
            success: false,
            message: "Role is required for changeRole action",
          });
        }

        for (const userId of userIds) {
          try {
            const user = await User.findById(userId);
            if (user && user.role !== "admin") {
              user.role = role;
              user.addAdminNote(
                `Role changed to ${role} by ${adminName}`,
                adminId,
                adminName
              );
              await user.save();
              result.success++;
            } else if (user && user.role === "admin") {
              result.failed++;
              result.errors.push(`Cannot change role of admin user ${userId}`);
            } else {
              result.failed++;
              result.errors.push(`User ${userId} not found`);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(
              `Failed to change role for ${userId}: ${error.message}`
            );
          }
        }
        break;

      case "delete":
        for (const userId of userIds) {
          try {
            const user = await User.findById(userId);
            if (user && user.role !== "admin") {
              user.isDeleted = true;
              user.deletedAt = new Date();
              user.addAdminNote(
                `Account deleted by ${adminName}`,
                adminId,
                adminName
              );
              await user.save();
              result.success++;
            } else if (user && user.role === "admin") {
              result.failed++;
              result.errors.push(`Cannot delete admin user ${userId}`);
            } else {
              result.failed++;
              result.errors.push(`User ${userId} not found`);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to delete ${userId}: ${error.message}`);
          }
        }
        break;

      case "export":
        try {
          const users = await User.find({
            _id: { $in: userIds },
            isDeleted: { $ne: true },
          })
            .select("-password -refreshToken -temporaryPassword")
            .lean();

          const csvData = users.map((user) => ({
            ID: user._id,
            Name: user.name,
            Email: user.email,
            Phone: user.phone,
            Role: user.role,
            Status: user.isActive ? "Active" : "Inactive",
            Blocked: user.isBlocked ? "Yes" : "No",
            TotalSpent: user.totalSpent || 0,
            TotalOrders: user.totalOrders || 0,
            CreatedAt: user.createdAt,
            LastLogin: user.lastLogin || "Never",
          }));

          const filename = `users-export-${Date.now()}.csv`;
          const filepath = path.join(__dirname, "../../exports", filename);

          // Ensure exports directory exists
          const exportsDir = path.dirname(filepath);
          if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
          }

          const csvWriter = createObjectCsvWriter({
            path: filepath,
            header: [
              { id: "ID", title: "User ID" },
              { id: "Name", title: "Name" },
              { id: "Email", title: "Email" },
              { id: "Phone", title: "Phone" },
              { id: "Role", title: "Role" },
              { id: "Status", title: "Status" },
              { id: "Blocked", title: "Blocked" },
              { id: "TotalSpent", title: "Total Spent" },
              { id: "TotalOrders", title: "Total Orders" },
              { id: "CreatedAt", title: "Created At" },
              { id: "LastLogin", title: "Last Login" },
            ],
          });

          await csvWriter.writeRecords(csvData);

          result.success = users.length;
          result.exportFile = filename;
          result.downloadUrl = `/api/admin/users/download/${filename}`;
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: "Failed to export users",
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
    console.error("Bulk user action error:", error);
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

// Get user analytics
export const getUserAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const matchQuery = { isDeleted: { $ne: true } };
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
    }

    const analytics = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          blockedUsers: {
            $sum: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] },
          },
          adminUsers: {
            $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] },
          },
          sellerUsers: {
            $sum: { $cond: [{ $eq: ["$role", "seller"] }, 1, 0] },
          },
          regularUsers: {
            $sum: { $cond: [{ $eq: ["$role", "user"] }, 1, 0] },
          },
          totalSpent: { $sum: "$totalSpent" },
          avgSpent: { $avg: "$totalSpent" },
        },
      },
    ]);

    const roleBreakdown = await User.aggregate([
      { $match: matchQuery },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: analytics[0] || {
          totalUsers: 0,
          activeUsers: 0,
          blockedUsers: 0,
          adminUsers: 0,
          sellerUsers: 0,
          regularUsers: 0,
          totalSpent: 0,
          avgSpent: 0,
        },
        roleBreakdown,
      },
    });
  } catch (error) {
    console.error("Get user analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user analytics",
      error: error.message,
    });
  }
};

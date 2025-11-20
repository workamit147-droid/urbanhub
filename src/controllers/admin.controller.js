import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import mongoose from "mongoose";

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Dashboard Stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    // Online devices - for now, mock data since we don't have device model
    const onlineDevices = 432;

    // Recent orders count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Calculate growth percentages (mock data for now)
    const stats = {
      totalUsers: {
        value: totalUsers,
        change: 12, // percentage
      },
      totalProducts: {
        value: totalProducts,
        change: 8,
      },
      totalOrders: {
        value: totalOrders,
        change: -3,
      },
      onlineDevices: {
        value: onlineDevices,
        change: 15,
      },
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Users Management
export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") {
      query.role = status;
    }

    const users = await User.find(query)
      .select("-password -refreshToken")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -refreshToken"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's orders
    const orders = await Order.find({ customerId: req.params.id })
      .populate("items.productId")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({ user, orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // For simplicity, we'll toggle between "user" and "banned" roles
    // In a real app, you might have a separate status field
    user.role = user.role === "banned" ? "user" : "banned";
    await user.save();

    res.json({
      message: `User ${
        user.role === "banned" ? "banned" : "unbanned"
      } successfully`,
      user: {
        ...user.toObject(),
        password: undefined,
        refreshToken: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Products Management
export const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category = "all",
      stock = "all",
    } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (category !== "all") {
      query.categories = { $in: [category] };
    }
    if (stock === "low") {
      query.stock = { $lte: 10 };
    } else if (stock === "out") {
      query.stock = 0;
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      stock,
      category,
      images,
      size = "Medium",
      potType = "Plastic",
      color = "Green",
      indoorOutdoor = "Indoor",
      mrp = price,
      w = 10,
      h = 20,
      d = 10,
      weight = 1,
    } = req.body;

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const sku = `SKU-${Date.now()}`;

    const productData = {
      title,
      slug,
      description,
      categories: [category],
      attributes: {
        size,
        potType,
        color,
        indoorOutdoor,
      },
      images,
      price,
      mrp,
      stock,
      sellerId: req.user.id,
      sku,
      dimensions: {
        w,
        h,
        d,
        weight,
      },
    };

    const product = await Product.create(productData);
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const {
      title,
      description,
      price,
      mrp,
      stock,
      category,
      size,
      potType,
      color,
      indoorOutdoor,
      w,
      h,
      d,
      weight,
      images,
    } = req.body;

    const updateData = {
      title,
      description,
      categories: [category],
      attributes: {
        size,
        potType,
        color,
        indoorOutdoor,
      },
      images,
      price,
      mrp,
      stock,
      dimensions: {
        w,
        h,
        d,
        weight,
      },
    };

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Orders Management
export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "all" } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { orderNumber: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate("customerId", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customerId", "name email phone")
      .populate("items.productId", "title price");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      "pending",
      "confirmed",
      "packed",
      "delivered",
      "cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("customerId", "name email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Devices Management (Mock data for now)
export const getDevices = async (req, res) => {
  try {
    // Mock device data - in real app, you'd have a Device model
    const devices = [
      {
        id: "DEV-001",
        name: "Plant Monitor A1",
        owner: "John Doe",
        status: "online",
        lastSeen: new Date(),
        firmware: "1.2.3",
        model: "PM-100",
      },
      {
        id: "DEV-002",
        name: "Greenhouse Sensor",
        owner: "Jane Smith",
        status: "online",
        lastSeen: new Date(),
        firmware: "1.1.9",
        model: "GS-200",
      },
    ];

    res.json({ devices, pagination: { total: devices.length } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getDeviceById = async (req, res) => {
  try {
    // Mock device data
    const device = {
      id: req.params.id,
      name: "Plant Monitor A1",
      owner: "John Doe",
      status: "online",
      lastSeen: new Date(),
      firmware: "1.2.3",
      model: "PM-100",
      metrics: {
        moisture: [45, 48, 52],
        temperature: [22, 23, 21],
        humidity: [65, 67, 64],
        light: [1200, 1350, 1100],
      },
    };

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDevice = async (req, res) => {
  try {
    // Mock update
    res.json({ message: "Device updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reports
export const generateReport = async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate } = req.body;

    let data = [];
    let filename = "";

    switch (type) {
      case "users":
        data = await User.find({}).select("name email role createdAt");
        filename = "users-report.csv";
        break;
      case "orders":
        let query = {};
        if (startDate && endDate) {
          query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          };
        }
        data = await Order.find(query).populate("customerId", "name email");
        filename = "orders-report.csv";
        break;
      case "products":
        data = await Product.find({});
        filename = "products-report.csv";
        break;
      default:
        return res.status(400).json({ message: "Invalid report type" });
    }

    // In a real app, you'd generate CSV here
    // For now, just return the data
    res.json({
      message: "Report generated successfully",
      filename,
      data: data.slice(0, 10), // Limit for demo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin Profile
export const getAdminProfile = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select(
      "-password -refreshToken"
    );
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const admin = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password -refreshToken");

    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const admin = await User.findById(req.user.id);
    const isMatch = await admin.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

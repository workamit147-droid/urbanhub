import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";

// CREATE ORDER
export const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, notes, couponCode } = req.body;
    const customerId = req.user.id; // Assuming auth middleware sets req.user

    // Get user's cart
    const cart = await Cart.findOne({ userId: customerId }).populate(
      "items.productId"
    );

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Validate and calculate order items from cart
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.productId;

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found in cart`,
        });
      }

      if (!product.isActive || !product.isInStock(cartItem.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.title} is out of stock or unavailable`,
        });
      }

      const total = cartItem.priceAtAdd * cartItem.quantity;
      subtotal += total;

      orderItems.push({
        productId: product._id,
        title: product.title,
        slug: product.slug,
        image: product.images[0],
        attributes: product.attributes,
        quantity: cartItem.quantity,
        price: cartItem.priceAtAdd,
        total: total,
      });
    }

    // Use cart totals if available, otherwise calculate
    const finalSubtotal = cart.subtotal || subtotal;
    const shippingCost = 0; // Free shipping for now
    const taxAmount = 0; // No tax for now
    const discountAmount = cart.discount || 0;
    const totalAmount =
      cart.finalTotal ||
      finalSubtotal + shippingCost + taxAmount - discountAmount;

    // Format shipping address to match schema
    const formattedShippingAddress = {
      fullName: shippingAddress.fullName,
      phone: shippingAddress.phone,
      email: shippingAddress.email,
      addressLine1: shippingAddress.address, // Map 'address' to 'addressLine1'
      addressLine2: "",
      city: shippingAddress.city,
      state: shippingAddress.state,
      pincode: shippingAddress.pincode,
      country: "India",
    };

    // Use shipping address as billing address (same for now)
    const billingAddress = { ...formattedShippingAddress };

    // Generate Order Number and ID
    const count = await Order.countDocuments();
    const orderNumber = `ORD${String(count + 1).padStart(6, "0")}`;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const dailyCount = await Order.countDocuments({
      createdAt: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1
        ),
      },
    });
    const orderId = `ORD-${dateStr}-${String(dailyCount + 1).padStart(6, "0")}`;

    const order = await Order.create({
      orderId,
      orderNumber,
      customerId,
      items: orderItems,
      shippingAddress: formattedShippingAddress,
      billingAddress: billingAddress,
      payment: {
        method: paymentMethod || "cod",
        status: paymentMethod === "cod" ? "pending" : "pending",
      },
      subtotal: finalSubtotal,
      shippingCost,
      taxAmount,
      discountAmount,
      totalAmount,
      coupon: cart.coupon
        ? {
            code: cart.coupon.code,
            discount: cart.discount,
            couponId: cart.coupon._id,
          }
        : undefined,
      // Legacy fields for compatibility
      paymentMethod: paymentMethod || "cod",
      couponCode: cart.coupon?.code || couponCode,
    });

    // Reduce stock for ordered items
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    const populatedOrder = await Order.findById(order._id)
      .populate("customerId", "name email")
      .populate("items.productId", "title images");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: populatedOrder,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// GET ALL ORDERS (Admin)
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
    let conditions = [];

    // Archived filter
    if (archived === "true") {
      conditions.push({ isArchived: true });
    } else {
      conditions.push({
        $or: [{ isArchived: { $exists: false } }, { isArchived: false }],
      });
    }

    // Text search across multiple fields
    if (q) {
      const searchRegex = new RegExp(q, "i");
      conditions.push({
        $or: [
          { orderId: searchRegex },
          { orderNumber: searchRegex },
          { "shippingAddress.fullName": searchRegex },
          { "shippingAddress.email": searchRegex },
          { "shippingAddress.phone": searchRegex },
          { "items.title": searchRegex },
          { "items.sku": searchRegex },
        ],
      });
    }

    // Specific field searches
    if (orderId) conditions.push({ orderId: new RegExp(orderId, "i") });
    if (customerEmail)
      conditions.push({
        "shippingAddress.email": new RegExp(customerEmail, "i"),
      });
    if (customerPhone)
      conditions.push({
        "shippingAddress.phone": new RegExp(customerPhone, "i"),
      });
    if (trackingNumber) {
      conditions.push({
        $or: [
          { "fulfillment.trackingNumber": new RegExp(trackingNumber, "i") },
          { trackingNumber: new RegExp(trackingNumber, "i") }, // Legacy field
        ],
      });
    }

    // Status filters
    if (status) conditions.push({ status });
    if (paymentStatus) {
      conditions.push({
        $or: [
          { "payment.status": paymentStatus },
          { paymentStatus: paymentStatus }, // Legacy field
        ],
      });
    }
    if (fulfillmentStatus)
      conditions.push({ "fulfillment.status": fulfillmentStatus });
    if (paymentMethod) {
      conditions.push({
        $or: [
          { "payment.method": paymentMethod },
          { paymentMethod: paymentMethod }, // Legacy field
        ],
      });
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const dateCondition = {};
      if (dateFrom) dateCondition.$gte = new Date(dateFrom);
      if (dateTo) dateCondition.$lte = new Date(dateTo);
      conditions.push({ createdAt: dateCondition });
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      const amountCondition = {};
      if (minAmount) amountCondition.$gte = parseFloat(minAmount);
      if (maxAmount) amountCondition.$lte = parseFloat(maxAmount);
      conditions.push({ totalAmount: amountCondition });
    }

    const searchQuery = conditions.length > 0 ? { $and: conditions } : {};

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
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// GET USER ORDERS
export const getUserOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { customerId: req.user.id };
    if (status) query.status = status;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const orders = await Order.find(query)
      .populate("items.productId", "title images")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        totalOrders: total,
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

// GET SINGLE ORDER
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customerId", "name email")
      .populate("items.productId", "title images slug");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns this order or is admin
    if (
      order.customerId._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// UPDATE ORDER STATUS
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber, estimatedDelivery } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update status
    if (status) {
      order.status = status;
      if (status === "delivered") {
        order.deliveredAt = new Date();
      }
    }

    // Update tracking info
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (estimatedDelivery)
      order.estimatedDelivery = new Date(estimatedDelivery);

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("customerId", "name email")
      .populate("items.productId", "title images");

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
};

// CANCEL ORDER
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns this order
    if (order.customerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Check if order can be cancelled
    if (!order.canCancel()) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }

    order.status = "cancelled";
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// GET ORDER STATISTICS (Admin)
export const getOrderStats = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $in: ["delivered", "shipped"] } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

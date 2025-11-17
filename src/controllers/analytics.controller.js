import User from "../models/user.model.js";
import Order from "../models/order.model.js";

// Orders Analytics
export const getOrdersAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, period = "30d" } = req.query;

    // Calculate date range
    let start = new Date();
    let end = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last 30 days
      start.setDate(start.getDate() - 30);
    }

    // Get orders in date range
    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end },
    });

    // Calculate analytics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.total || 0),
      0
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Orders by status
    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Daily order counts
    const dailyOrders = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayOrders = orders.filter(
        (order) => order.createdAt >= dayStart && order.createdAt < dayEnd
      );

      dailyOrders.push({
        date: dayStart.toISOString().split("T")[0],
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, order) => sum + (order.total || 0), 0),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const analytics = {
      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue,
      },
      ordersByStatus,
      dailyOrders,
      dateRange: { start, end },
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Users Analytics
export const getUsersAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Calculate date range
    let start = new Date();
    let end = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default to last 30 days
      start.setDate(start.getDate() - 30);
    }

    // Get users in date range
    const users = await User.find({
      createdAt: { $gte: start, $lte: end },
    });

    // Calculate analytics
    const totalUsers = await User.countDocuments();
    const newUsers = users.length;

    // Users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    // Daily user registrations
    const dailyRegistrations = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayUsers = users.filter(
        (user) => user.createdAt >= dayStart && user.createdAt < dayEnd
      );

      dailyRegistrations.push({
        date: dayStart.toISOString().split("T")[0],
        registrations: dayUsers.length,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const analytics = {
      summary: {
        totalUsers,
        newUsers,
      },
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      dailyRegistrations,
      dateRange: { start, end },
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

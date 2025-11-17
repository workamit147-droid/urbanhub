import mongoose from "mongoose";

// Enhanced order item schema with SKU and HSN for invoicing
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    hsn: {
      type: String,
      trim: true,
    },
    image: {
      url: String,
      alt: String,
    },
    attributes: {
      size: String,
      potType: String,
      color: String,
      indoorOutdoor: String,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
  },
  { _id: false }
);

// Notes schema for admin and public notes
const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["internal", "public"],
      default: "internal",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Audit trail schema
const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    byAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    byAdminName: {
      type: String,
      required: true,
    },
    from: {
      type: String,
    },
    to: {
      type: String,
    },
    note: {
      type: String,
      maxlength: 500,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// Billing address schema (same structure as shipping for consistency)
const billingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // Human-friendly order ID
    orderId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],

    // Enhanced status management
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
        "refunded",
      ],
      default: "pending",
    },

    // Addresses
    shippingAddress: shippingAddressSchema,
    billingAddress: billingAddressSchema,

    // Enhanced payment tracking
    payment: {
      method: {
        type: String,
        enum: ["card", "upi", "netbanking", "cod", "wallet"],
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
        default: "pending",
      },
      transactionId: {
        type: String,
        trim: true,
      },
      gateway: {
        type: String,
        trim: true,
      },
      refundAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      refundReason: {
        type: String,
        trim: true,
      },
      refundType: {
        type: String,
        enum: ["full", "partial"],
      },
      refundedAt: {
        type: Date,
      },
    },

    // Enhanced fulfillment tracking
    fulfillment: {
      status: {
        type: String,
        enum: [
          "not_shipped",
          "shipped",
          "out_for_delivery",
          "delivered",
          "failed",
        ],
        default: "not_shipped",
      },
      carrier: {
        type: String,
        trim: true,
      },
      trackingNumber: {
        type: String,
        trim: true,
      },
      shippedAt: {
        type: Date,
      },
      deliveredAt: {
        type: Date,
      },
      eta: {
        type: Date,
      },
      failureReason: {
        type: String,
        trim: true,
      },
    },

    // Pricing breakdown
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    adjustments: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },

    // Applied coupon details
    coupon: {
      code: {
        type: String,
        trim: true,
      },
      discount: {
        type: Number,
        default: 0,
      },
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
    },

    // Notes and communication
    notes: {
      public: [noteSchema],
      internal: [noteSchema],
    },

    // Audit trail
    audit: [auditSchema],

    // Soft delete
    isArchived: {
      type: Boolean,
      default: false,
    },

    // Invoice tracking
    invoiceGenerated: {
      type: Boolean,
      default: false,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    invoiceGeneratedAt: {
      type: Date,
    },

    // Legacy fields (maintain compatibility)
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "cod", "wallet"],
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
    },
    paymentId: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    estimatedDelivery: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    notes_legacy: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    couponCode: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
orderSchema.index({ customerId: 1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "fulfillment.status": 1 });
orderSchema.index({ "fulfillment.trackingNumber": 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ "items.productId": 1 });
orderSchema.index({ isArchived: 1 });
orderSchema.index({ invoiceNumber: 1 });

// Virtual for order age
orderSchema.virtual("orderAge").get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

// Method to calculate totals
orderSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.totalAmount =
    this.subtotal +
    this.shippingCost +
    this.taxAmount -
    this.discountAmount +
    (this.adjustments || 0);
};

// Method to check if order can be cancelled
orderSchema.methods.canCancel = function () {
  return ["pending", "confirmed"].includes(this.status);
};

// Method to check if order can be returned
orderSchema.methods.canReturn = function () {
  if (this.status !== "delivered" || !this.fulfillment?.deliveredAt)
    return false;
  const daysSinceDelivery = Math.floor(
    (Date.now() - this.fulfillment.deliveredAt) / (1000 * 60 * 60 * 24)
  );
  return daysSinceDelivery <= 30; // 30-day return policy
};

// Method to add audit log
orderSchema.methods.addAuditLog = function (
  action,
  adminId,
  adminName,
  from,
  to,
  note
) {
  this.audit.push({
    action,
    byAdminId: adminId,
    byAdminName: adminName,
    from: from || null,
    to: to || null,
    note: note || null,
  });
};

// Method to add note
orderSchema.methods.addNote = function (
  text,
  adminId,
  adminName,
  type = "internal"
) {
  const note = {
    text,
    adminId,
    adminName,
    type,
  };

  if (type === "internal") {
    this.notes.internal.push(note);
  } else {
    this.notes.public.push(note);
  }
};

// Method to update status with audit trail
orderSchema.methods.updateStatus = function (
  newStatus,
  adminId,
  adminName,
  note
) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Update fulfillment status based on order status
  switch (newStatus) {
    case "shipped":
      this.fulfillment.status = "shipped";
      if (!this.fulfillment.shippedAt) {
        this.fulfillment.shippedAt = new Date();
      }
      break;
    case "out_for_delivery":
      this.fulfillment.status = "out_for_delivery";
      break;
    case "delivered":
      this.fulfillment.status = "delivered";
      if (!this.fulfillment.deliveredAt) {
        this.fulfillment.deliveredAt = new Date();
      }
      break;
  }

  // Add to audit trail
  this.addAuditLog(
    `Status changed from ${oldStatus} to ${newStatus}`,
    adminId,
    adminName,
    oldStatus,
    newStatus,
    note
  );
};

// Pre-save middleware to generate order ID and number
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    if (!this.orderNumber) {
      const count = await mongoose.model("Order").countDocuments();
      this.orderNumber = `ORD${String(count + 1).padStart(6, "0")}`;
    }

    if (!this.orderId) {
      // Generate human-friendly order ID: ORD-YYYYMMDD-NNNNNN
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
      const dailyCount = await mongoose.model("Order").countDocuments({
        createdAt: {
          $gte: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          ),
          $lt: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 1
          ),
        },
      });
      this.orderId = `ORD-${dateStr}-${String(dailyCount + 1).padStart(
        6,
        "0"
      )}`;
    }

    // Migrate legacy fields to new structure if they exist
    if (this.paymentMethod) {
      this.payment.method = this.paymentMethod;
    }
    if (this.paymentStatus) {
      this.payment.status =
        this.paymentStatus === "completed" ? "paid" : this.paymentStatus;
    }
    if (this.paymentId) {
      this.payment.transactionId = this.paymentId;
    }
    if (this.trackingNumber) {
      this.fulfillment.trackingNumber = this.trackingNumber;
    }
    if (this.estimatedDelivery) {
      this.fulfillment.eta = this.estimatedDelivery;
    }
    if (this.deliveredAt) {
      this.fulfillment.deliveredAt = this.deliveredAt;
    }
    if (this.notes_legacy) {
      this.notes.internal.push({
        text: this.notes_legacy,
        adminId: this.customerId, // Fallback
        adminName: "System",
        type: "internal",
      });
    }
    if (this.couponCode) {
      this.coupon.code = this.couponCode;
    }
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);

export default Order;

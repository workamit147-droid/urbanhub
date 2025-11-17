import mongoose from "mongoose";

// Invoice item schema for detailed line items
const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    hsn: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// Address schema for invoice
const invoiceAddressSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
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
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    gstin: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    // Invoice identification
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Related order
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // Customer information
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Addresses (snapshot at time of invoice)
    billingAddress: invoiceAddressSchema,
    shippingAddress: invoiceAddressSchema,

    // Invoice dates
    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },

    // Line items
    items: [invoiceItemSchema],

    // Pricing breakdown
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
      min: 0,
    },
    adjustments: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    // Currency
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },

    // Payment information
    paymentMethod: {
      type: String,
      enum: ["card", "upi", "netbanking", "cod", "wallet"],
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_paid"],
      default: "pending",
    },
    paymentTerms: {
      type: String,
      trim: true,
    },

    // Applied coupon
    coupon: {
      code: {
        type: String,
        trim: true,
      },
      discount: {
        type: Number,
        default: 0,
      },
    },

    // Tax breakdown
    taxes: [
      {
        name: {
          type: String,
          required: true,
        },
        rate: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    // Invoice status
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "cancelled", "refunded"],
      default: "draft",
    },

    // PDF generation
    pdfGenerated: {
      type: Boolean,
      default: false,
    },
    pdfPath: {
      type: String,
      trim: true,
    },
    pdfUrl: {
      type: String,
      trim: true,
    },

    // Email tracking
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
    emailSentTo: {
      type: String,
      trim: true,
    },

    // Company information (snapshot)
    company: {
      name: {
        type: String,
        required: true,
      },
      logo: {
        type: String,
      },
      address: invoiceAddressSchema,
      phone: {
        type: String,
      },
      email: {
        type: String,
      },
      website: {
        type: String,
      },
      gstin: {
        type: String,
      },
      pan: {
        type: String,
      },
    },

    // Terms and notes
    notes: {
      type: String,
      trim: true,
    },
    termsAndConditions: {
      type: String,
      trim: true,
    },

    // Footer text
    footerText: {
      type: String,
      trim: true,
    },

    // QR code for payment/invoice link
    qrCode: {
      type: String, // base64 encoded QR code
    },
    qrCodeData: {
      type: String, // URL or data for QR code
    },

    // Template used
    template: {
      type: String,
      default: "default",
      trim: true,
    },

    // Locale settings
    locale: {
      type: String,
      default: "en-IN",
    },

    // Created by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
      trim: true,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ isDeleted: 1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for overdue status
invoiceSchema.virtual("isOverdue").get(function () {
  if (!this.dueDate || this.paymentStatus === "paid") {
    return false;
  }
  return this.dueDate < new Date();
});

// Virtual for days overdue
invoiceSchema.virtual("daysOverdue").get(function () {
  if (!this.isOverdue) {
    return 0;
  }
  return Math.floor((Date.now() - this.dueDate) / (1000 * 60 * 60 * 24));
});

// Method to calculate totals
invoiceSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  this.totalDiscount = this.items.reduce((sum, item) => sum + item.discount, 0);
  this.totalTax = this.items.reduce((sum, item) => sum + item.taxAmount, 0);

  this.grandTotal =
    this.subtotal -
    this.totalDiscount +
    this.shippingCost +
    this.totalTax +
    (this.adjustments || 0);

  // Apply coupon discount
  if (this.coupon && this.coupon.discount) {
    this.grandTotal -= this.coupon.discount;
  }

  // Ensure grand total is not negative
  this.grandTotal = Math.max(0, this.grandTotal);
};

// Method to generate invoice number
invoiceSchema.methods.generateInvoiceNumber = async function () {
  if (!this.invoiceNumber) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    // Count invoices created today
    const dailyCount = await mongoose.model("Invoice").countDocuments({
      invoiceDate: {
        $gte: new Date(year, today.getMonth(), today.getDate()),
        $lt: new Date(year, today.getMonth(), today.getDate() + 1),
      },
      isDeleted: { $ne: true },
    });

    this.invoiceNumber = `INV-${year}${month}${day}-${String(
      dailyCount + 1
    ).padStart(6, "0")}`;
  }
  return this.invoiceNumber;
};

// Method to mark as paid
invoiceSchema.methods.markAsPaid = function (paymentDate = new Date()) {
  this.paymentStatus = "paid";
  this.status = "paid";
  // Could add payment date tracking here
};

// Method to mark email as sent
invoiceSchema.methods.markEmailSent = function (recipient) {
  this.emailSent = true;
  this.emailSentAt = new Date();
  this.emailSentTo = recipient;
};

// Pre-save middleware
invoiceSchema.pre("save", async function (next) {
  if (this.isNew) {
    await this.generateInvoiceNumber();
    this.calculateTotals();
  }
  next();
});

// Static method to find active invoices
invoiceSchema.statics.findActive = function (filter = {}) {
  return this.find({
    ...filter,
    isDeleted: { $ne: true },
  });
};

const Invoice = mongoose.model("Invoice", invoiceSchema);

export default Invoice;

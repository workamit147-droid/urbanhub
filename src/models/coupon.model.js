import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    discountType: {
      type: String,
      enum: ["percentage"],
      default: "percentage",
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
      max: 100, // For percentage, max 100%
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    maxUsage: {
      type: Number,
      default: null, // null means unlimited
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });
couponSchema.index({ applicableProducts: 1 });

// Virtual for checking if coupon is valid based on dates
couponSchema.virtual("isDateValid").get(function () {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// Method to check if coupon is fully valid
couponSchema.methods.isValid = function () {
  const now = new Date();
  const isDateValid = now >= this.startDate && now <= this.endDate;
  const isUsageValid = !this.maxUsage || this.usageCount < this.maxUsage;

  return this.isActive && isDateValid && isUsageValid;
};

// Method to check if coupon applies to given products
couponSchema.methods.isApplicableToProducts = function (productIds) {
  const applicableProductIds = this.applicableProducts.map((id) =>
    id.toString()
  );
  return productIds.some((productId) =>
    applicableProductIds.includes(productId.toString())
  );
};

// Method to calculate discount for given cart items
couponSchema.methods.calculateDiscount = function (cartItems) {
  if (!this.isValid()) return 0;

  const applicableProductIds = this.applicableProducts.map((id) =>
    id.toString()
  );

  let applicableSubtotal = 0;
  const applicableItems = [];

  cartItems.forEach((item) => {
    if (applicableProductIds.includes(item.productId.toString())) {
      const itemTotal = item.priceAtAdd * item.quantity;
      applicableSubtotal += itemTotal;
      applicableItems.push(item);
    }
  });

  if (applicableSubtotal === 0) return 0;

  let discountAmount = 0;
  if (this.discountType === "percentage") {
    discountAmount = Math.round(
      (applicableSubtotal * this.discountValue) / 100
    );
  }

  return {
    discountAmount,
    applicableSubtotal,
    applicableItems,
  };
};

const Coupon = mongoose.model("Coupon", couponSchema);

export default Coupon;

import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Snapshot of product data at the time of adding to cart
    productSnapshot: {
      title: {
        type: String,
        required: true,
      },
      sku: {
        type: String,
        required: true,
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
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceAtAdd: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const cartCouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow guest carts
    },
    sessionId: {
      type: String,
      required: false, // For guest carts
    },
    items: [cartItemSchema],
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    coupon: {
      type: cartCouponSchema,
      default: null,
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1 });
cartSchema.index({ "items.productId": 1 });

// Virtual for item count
cartSchema.virtual("itemCount").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Method to calculate subtotal
cartSchema.methods.calculateSubtotal = function () {
  this.subtotal = this.items.reduce((total, item) => {
    return total + item.priceAtAdd * item.quantity;
  }, 0);
  return this.subtotal;
};

// Method to calculate final total with coupon
cartSchema.methods.calculateFinalTotal = function () {
  this.calculateSubtotal();
  this.totalDiscount = this.coupon ? this.coupon.discountAmount : 0;
  this.finalTotal = Math.max(0, this.subtotal - this.totalDiscount);
  return this.finalTotal;
};

// Method to add item to cart
cartSchema.methods.addItem = function (productData, quantity, price) {
  const existingItemIndex = this.items.findIndex(
    (item) => item.productId.toString() === productData._id.toString()
  );

  if (existingItemIndex > -1) {
    // Update existing item quantity
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    const newItem = {
      productId: productData._id,
      productSnapshot: {
        title: productData.title,
        sku: productData.sku,
        image: productData.images?.[0] || {},
        attributes: productData.attributes,
      },
      quantity,
      priceAtAdd: price,
    };
    this.items.push(newItem);
  }

  this.calculateFinalTotal();
  return this;
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function (itemId, newQuantity) {
  if (newQuantity <= 0) {
    return this.removeItem(itemId);
  }

  const item = this.items.id(itemId);
  if (item) {
    item.quantity = newQuantity;
    this.calculateFinalTotal();
  }
  return this;
};

// Method to remove item from cart
cartSchema.methods.removeItem = function (itemId) {
  this.items = this.items.filter(
    (item) => item._id.toString() !== itemId.toString()
  );
  this.calculateFinalTotal();

  // Remove coupon if no applicable products remain
  if (this.coupon && this.items.length > 0) {
    const hasApplicableProducts = this.items.some((item) =>
      this.coupon.applicableProducts.some(
        (productId) => productId.toString() === item.productId.toString()
      )
    );

    if (!hasApplicableProducts) {
      this.coupon = null;
      this.calculateFinalTotal();
    }
  } else if (this.items.length === 0) {
    this.coupon = null;
    this.calculateFinalTotal();
  }

  return this;
};

// Method to clear cart
cartSchema.methods.clearCart = function () {
  this.items = [];
  this.coupon = null;
  this.calculateFinalTotal();
  return this;
};

// Method to apply coupon
cartSchema.methods.applyCoupon = function (couponData, discountCalculation) {
  this.coupon = {
    code: couponData.code,
    discountType: couponData.discountType,
    discountValue: couponData.discountValue,
    discountAmount: discountCalculation.discountAmount,
    applicableProducts: couponData.applicableProducts,
  };
  this.calculateFinalTotal();
  return this;
};

// Method to remove coupon
cartSchema.methods.removeCoupon = function () {
  this.coupon = null;
  this.calculateFinalTotal();
  return this;
};

// Method to merge with another cart
cartSchema.methods.mergeWith = function (otherCart) {
  if (!otherCart || !otherCart.items) return this;

  otherCart.items.forEach((otherItem) => {
    const existingItemIndex = this.items.findIndex(
      (item) => item.productId.toString() === otherItem.productId.toString()
    );

    if (existingItemIndex > -1) {
      // Sum quantities, keep the latest price
      this.items[existingItemIndex].quantity += otherItem.quantity;
      this.items[existingItemIndex].priceAtAdd = otherItem.priceAtAdd;
    } else {
      // Add the item
      this.items.push(otherItem);
    }
  });

  // Remove coupon as merge might affect applicability
  this.coupon = null;
  this.calculateFinalTotal();
  return this;
};

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;

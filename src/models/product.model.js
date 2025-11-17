import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    categories: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    attributes: {
      size: {
        type: String,
        enum: ["Small", "Medium", "Large", "Extra Large"],
        required: true,
      },
      potType: {
        type: String,
        enum: ["Plastic", "Ceramic", "Clay", "Metal", "Wooden"],
        required: true,
      },
      color: {
        type: String,
        required: true,
        trim: true,
      },
      indoorOutdoor: {
        type: String,
        enum: ["Indoor", "Outdoor", "Both"],
        required: true,
      },
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        alt: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    dimensions: {
      w: {
        type: Number,
        required: true,
        min: 0,
      },
      h: {
        type: Number,
        required: true,
        min: 0,
      },
      d: {
        type: Number,
        required: true,
        min: 0,
      },
      weight: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    shippingEligible: {
      type: Boolean,
      default: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    careInstructions: {
      type: String,
      maxlength: 2000,
    },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
    },
    lightRequirements: {
      type: String,
      enum: [
        "Low Light",
        "Medium Light",
        "Bright Indirect Light",
        "Direct Sunlight",
      ],
    },
    waterFrequency: {
      type: String,
      enum: ["Daily", "Every 2-3 days", "Weekly", "Bi-weekly", "Monthly"],
    },
    temperature: {
      type: String,
      maxlength: 100,
    },
    humidity: {
      type: String,
      enum: ["Low", "Medium", "High"],
    },
    toxicity: {
      type: String,
      enum: ["Non-toxic", "Toxic to pets", "Toxic to humans", "Toxic to both"],
    },
    seoTitle: {
      type: String,
      maxlength: 60,
    },
    seoDescription: {
      type: String,
      maxlength: 160,
    },
    metaKeywords: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
productSchema.index({ categories: 1 });
productSchema.index({ "attributes.size": 1 });
productSchema.index({ "attributes.indoorOutdoor": 1 });
productSchema.index({ price: 1 });
productSchema.index({ sellerId: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ featured: 1 });
productSchema.index({ difficulty: 1 });
productSchema.index({ lightRequirements: 1 });
productSchema.index({ toxicity: 1 });
productSchema.index({ metaKeywords: 1 });

// Virtual for discount percentage
productSchema.virtual("discountPercentage").get(function () {
  if (this.mrp > this.price) {
    return Math.round(((this.mrp - this.price) / this.mrp) * 100);
  }
  return 0;
});

// Virtual for formatted rating display
productSchema.virtual("formattedRating").get(function () {
  if (this.rating > 0) {
    return `${this.rating}★ | ${this.reviewCount}`;
  }
  return "No reviews yet";
});

// Method to update rating
productSchema.methods.updateRating = function (newRating) {
  const totalRating = this.rating * this.reviewCount;
  this.reviewCount += 1;
  this.rating = (totalRating + newRating) / this.reviewCount;
  return this.save();
};

// Method to check if product is in stock
productSchema.methods.isInStock = function (quantity = 1) {
  return this.stock >= quantity;
};

// Method to reduce stock
productSchema.methods.reduceStock = function (quantity) {
  if (this.stock >= quantity) {
    this.stock -= quantity;
    return this.save();
  }
  throw new Error("Insufficient stock");
};

const Product = mongoose.model("Product", productSchema);

export default Product;

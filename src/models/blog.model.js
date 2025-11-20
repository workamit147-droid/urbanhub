import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    excerpt: {
      type: String,
      required: true,
      maxlength: 300,
    },
    content: {
      type: String,
      required: true,
    },
    featuredImage: {
      url: {
        type: String,
        required: true,
      },
      alt: {
        type: String,
        default: "",
      },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Plant Care",
        "Gardening Tips",
        "Indoor Plants",
        "Outdoor Plants",
        "Sustainability",
        "DIY Projects",
        "Plant Health",
        "Seasonal Guide",
        "News",
        "Other",
      ],
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    views: {
      type: Number,
      default: 0,
    },
    readTime: {
      type: Number, // in minutes
      default: 5,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1 });
blogSchema.index({ category: 1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ isFeatured: 1 });

// Virtual for URL
blogSchema.virtual("url").get(function () {
  return `/blog/${this.slug}`;
});

// Method to increment views
blogSchema.methods.incrementViews = function () {
  this.views += 1;
  return this.save();
};

// Static method to get published blogs
blogSchema.statics.getPublished = function (options = {}) {
  const query = { status: "published" };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.tag) {
    query.tags = options.tag;
  }
  
  if (options.isFeatured !== undefined) {
    query.isFeatured = options.isFeatured;
  }

  return this.find(query)
    .populate("author", "name email")
    .sort({ publishedAt: -1 })
    .limit(options.limit || 10)
    .skip(options.skip || 0);
};

// Pre-save hook to set publishedAt when status changes to published
blogSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

const Blog = mongoose.model("Blog", blogSchema);

export default Blog;

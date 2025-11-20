import Blog from "../models/blog.model.js";
import mongoose from "mongoose";

// Helper function to generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

// Helper function to calculate read time
const calculateReadTime = (content) => {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

// GET ALL BLOGS (Public - only published)
export const getAllBlogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      search,
      featured,
    } = req.query;

    const query = { status: "published" };

    if (category) {
      query.category = category;
    }

    if (tag) {
      query.tags = tag;
    }

    if (featured === "true") {
      query.isFeatured = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blogs = await Blog.find(query)
      .populate("author", "name email")
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select("-content"); // Exclude full content for list view

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// GET SINGLE BLOG BY SLUG (Public)
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({ slug, status: "published" }).populate(
      "author",
      "name email"
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Increment views
    await blog.incrementViews();

    res.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get blog by slug error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// GET FEATURED BLOGS (Public)
export const getFeaturedBlogs = async (req, res) => {
  try {
    const { limit = 3 } = req.query;

    const blogs = await Blog.find({ status: "published", isFeatured: true })
      .populate("author", "name email")
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select("-content");

    res.json({
      success: true,
      blogs,
    });
  } catch (error) {
    console.error("Get featured blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured blogs",
      error: error.message,
    });
  }
};

// GET RELATED BLOGS (Public)
export const getRelatedBlogs = async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit = 3 } = req.query;

    const currentBlog = await Blog.findOne({ slug });
    if (!currentBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const relatedBlogs = await Blog.find({
      _id: { $ne: currentBlog._id },
      status: "published",
      $or: [
        { category: currentBlog.category },
        { tags: { $in: currentBlog.tags } },
      ],
    })
      .populate("author", "name email")
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .select("-content");

    res.json({
      success: true,
      blogs: relatedBlogs,
    });
  } catch (error) {
    console.error("Get related blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch related blogs",
      error: error.message,
    });
  }
};

// ADMIN: GET ALL BLOGS (including drafts)
export const adminGetAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, search } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blogs = await Blog.find(query)
      .populate("author", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Admin get all blogs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
      error: error.message,
    });
  }
};

// ADMIN: GET SINGLE BLOG BY ID
export const adminGetBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID",
      });
    }

    const blog = await Blog.findById(id).populate("author", "name email");

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Admin get blog by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
      error: error.message,
    });
  }
};

// ADMIN: CREATE BLOG
export const createBlog = async (req, res) => {
  try {
    const {
      title,
      excerpt,
      content,
      featuredImage,
      category,
      tags,
      status,
      isFeatured,
      seo,
    } = req.body;

    // Validation
    if (!title || !excerpt || !content || !featuredImage || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Generate slug
    let slug = generateSlug(title);
    
    // Ensure slug is unique
    let slugExists = await Blog.findOne({ slug });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(title)}-${counter}`;
      slugExists = await Blog.findOne({ slug });
      counter++;
    }

    // Calculate read time
    const readTime = calculateReadTime(content);

    const blog = new Blog({
      title,
      slug,
      excerpt,
      content,
      featuredImage,
      author: req.user.id,
      category,
      tags: tags || [],
      status: status || "draft",
      isFeatured: isFeatured || false,
      readTime,
      seo: seo || {},
    });

    await blog.save();

    const populatedBlog = await Blog.findById(blog._id).populate(
      "author",
      "name email"
    );

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog: populatedBlog,
    });
  } catch (error) {
    console.error("Create blog error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create blog",
      error: error.message,
    });
  }
};

// ADMIN: UPDATE BLOG
export const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      excerpt,
      content,
      featuredImage,
      category,
      tags,
      status,
      isFeatured,
      seo,
    } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID",
      });
    }

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Update fields
    if (title) {
      blog.title = title;
      // Regenerate slug if title changed
      let newSlug = generateSlug(title);
      if (newSlug !== blog.slug) {
        let slugExists = await Blog.findOne({ slug: newSlug, _id: { $ne: id } });
        let counter = 1;
        while (slugExists) {
          newSlug = `${generateSlug(title)}-${counter}`;
          slugExists = await Blog.findOne({ slug: newSlug, _id: { $ne: id } });
          counter++;
        }
        blog.slug = newSlug;
      }
    }

    if (excerpt) blog.excerpt = excerpt;
    if (content) {
      blog.content = content;
      blog.readTime = calculateReadTime(content);
    }
    if (featuredImage) blog.featuredImage = featuredImage;
    if (category) blog.category = category;
    if (tags !== undefined) blog.tags = tags;
    if (status) blog.status = status;
    if (isFeatured !== undefined) blog.isFeatured = isFeatured;
    if (seo) blog.seo = { ...blog.seo, ...seo };

    await blog.save();

    const updatedBlog = await Blog.findById(id).populate("author", "name email");

    res.json({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog,
    });
  } catch (error) {
    console.error("Update blog error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

// ADMIN: DELETE BLOG
export const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid blog ID",
      });
    }

    const blog = await Blog.findByIdAndDelete(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    res.json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

// ADMIN: GET BLOG STATISTICS
export const getBlogStats = async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ status: "published" });
    const draftBlogs = await Blog.countDocuments({ status: "draft" });
    const totalViews = await Blog.aggregate([
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]);

    const categoryStats = await Blog.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        total: totalBlogs,
        published: publishedBlogs,
        draft: draftBlogs,
        totalViews: totalViews[0]?.total || 0,
        byCategory: categoryStats,
      },
    });
  } catch (error) {
    console.error("Get blog stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog statistics",
      error: error.message,
    });
  }
};

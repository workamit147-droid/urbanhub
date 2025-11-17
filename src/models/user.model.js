import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Enhanced address schema for multiple addresses
const addressSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["home", "work", "billing", "shipping", "other"],
      default: "home",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
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
      default: "India",
      trim: true,
    },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    password: { type: String, required: true },

    phone: { type: String, default: "" },

    dateOfBirth: { type: Date },

    // Legacy address field (maintain compatibility)
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    // Enhanced addresses system
    addresses: [addressSchema],

    profileImage: { type: String, default: "" },

    role: {
      type: String,
      enum: ["admin", "seller", "user", "support"],
      default: "user",
    },

    isActive: { type: Boolean, default: true },

    // User management fields
    isBlocked: {
      type: Boolean,
      default: false,
    },

    blockedAt: {
      type: Date,
    },

    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    blockReason: {
      type: String,
      trim: true,
    },

    // Login tracking
    lastLogin: {
      type: Date,
    },

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
    },

    // Purchase tracking
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Password reset
    passwordResetRequired: {
      type: Boolean,
      default: false,
    },

    passwordResetToken: {
      type: String,
    },

    passwordResetExpires: {
      type: Date,
    },

    temporaryPassword: {
      type: String,
    },

    temporaryPasswordExpires: {
      type: Date,
    },

    // Admin metadata
    adminNotes: [
      {
        note: {
          type: String,
          required: true,
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
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Preferences
    preferences: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      smsNotifications: {
        type: Boolean,
        default: false,
      },
      newsletter: {
        type: Boolean,
        default: false,
      },
    },

    refreshToken: { type: String, default: "" },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for full display name
userSchema.virtual("displayName").get(function () {
  return this.name || this.email.split("@")[0];
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to handle failed login attempts
userSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        lockUntil: 1,
      },
      $set: {
        loginAttempts: 1,
      },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
    };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1,
    },
    $set: {
      lastLogin: new Date(),
    },
  });
};

// Method to block user
userSchema.methods.blockUser = function (adminId, reason) {
  this.isBlocked = true;
  this.blockedAt = new Date();
  this.blockedBy = adminId;
  this.blockReason = reason;
};

// Method to unblock user
userSchema.methods.unblockUser = function () {
  this.isBlocked = false;
  this.blockedAt = undefined;
  this.blockedBy = undefined;
  this.blockReason = undefined;
};

// Method to add admin note
userSchema.methods.addAdminNote = function (note, adminId, adminName) {
  this.adminNotes.push({
    note,
    adminId,
    adminName,
  });
};

// Method to update purchase stats
userSchema.methods.updatePurchaseStats = function (orderTotal) {
  this.totalSpent += orderTotal;
  this.totalOrders += 1;
};

// Method to get default address
userSchema.methods.getDefaultAddress = function (type = null) {
  if (type) {
    return (
      this.addresses.find((addr) => addr.type === type && addr.isDefault) ||
      this.addresses.find((addr) => addr.type === type)
    );
  }
  return this.addresses.find((addr) => addr.isDefault) || this.addresses[0];
};

// Method to set default address
userSchema.methods.setDefaultAddress = function (addressId) {
  // Remove default from all addresses
  this.addresses.forEach((addr) => {
    addr.isDefault = addr._id.toString() === addressId.toString();
  });
};

// Method to generate temporary password
userSchema.methods.generateTempPassword = function () {
  const tempPassword = Math.random().toString(36).slice(-8);
  this.temporaryPassword = bcrypt.hashSync(tempPassword, 10);
  this.temporaryPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  this.passwordResetRequired = true;
  return tempPassword; // Return plain text for sending to user
};

// Method to verify temporary password
userSchema.methods.verifyTempPassword = function (candidatePassword) {
  if (!this.temporaryPassword || !this.temporaryPasswordExpires) {
    return false;
  }

  if (this.temporaryPasswordExpires < Date.now()) {
    return false;
  }

  return bcrypt.compareSync(candidatePassword, this.temporaryPassword);
};

// Method to clear temporary password
userSchema.methods.clearTempPassword = function () {
  this.temporaryPassword = undefined;
  this.temporaryPasswordExpires = undefined;
  this.passwordResetRequired = false;
};

// Static method to find non-deleted users
userSchema.statics.findActive = function (filter = {}) {
  return this.find({
    ...filter,
    isDeleted: { $ne: true },
  });
};

// Static method to find non-blocked users
userSchema.statics.findUnblocked = function (filter = {}) {
  return this.find({
    ...filter,
    isBlocked: { $ne: true },
    isDeleted: { $ne: true },
  });
};

const User = mongoose.model("User", userSchema);

export default User;

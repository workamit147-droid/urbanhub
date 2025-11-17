import mongoose from "mongoose";

// Company address schema
const companyAddressSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

// Email template schema
const emailTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    variables: [
      {
        key: String,
        description: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Tax configuration schema
const taxConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// Payment gateway configuration
const paymentGatewaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ["razorpay", "stripe", "payu", "cashfree"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    config: {
      type: mongoose.Schema.Types.Mixed, // Store encrypted configuration
    },
    testMode: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const settingsSchema = new mongoose.Schema(
  {
    // Singleton pattern - only one settings document
    _id: {
      type: String,
      default: "settings",
    },

    // Company Information
    company: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      legalName: {
        type: String,
        trim: true,
      },
      logo: {
        url: {
          type: String,
          trim: true,
        },
        alt: {
          type: String,
          trim: true,
        },
      },
      favicon: {
        type: String,
        trim: true,
      },
      address: companyAddressSchema,
      phone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      website: {
        type: String,
        trim: true,
      },

      // Tax details
      gstin: {
        type: String,
        trim: true,
      },
      pan: {
        type: String,
        trim: true,
      },
      cin: {
        type: String,
        trim: true,
      },

      // Banking details
      bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        branch: String,
        ifscCode: String,
        swiftCode: String,
      },
    },

    // Invoice Settings
    invoice: {
      // Template settings
      template: {
        type: String,
        default: "default",
        enum: ["default", "modern", "classic", "minimal"],
      },

      // Header customization
      header: {
        showLogo: {
          type: Boolean,
          default: true,
        },
        showCompanyDetails: {
          type: Boolean,
          default: true,
        },
        customText: {
          type: String,
          trim: true,
        },
      },

      // Footer customization
      footer: {
        text: {
          type: String,
          trim: true,
        },
        showTerms: {
          type: Boolean,
          default: true,
        },
        showSignature: {
          type: Boolean,
          default: true,
        },
        signature: {
          name: String,
          title: String,
          image: String,
        },
      },

      // Default terms and conditions
      termsAndConditions: {
        type: String,
        trim: true,
      },

      // Default notes
      defaultNotes: {
        type: String,
        trim: true,
      },

      // Payment terms
      paymentTerms: {
        type: String,
        default: "Net 30",
        trim: true,
      },

      // Auto-generation settings
      autoGenerate: {
        type: Boolean,
        default: true,
      },

      // QR code settings
      qrCode: {
        enabled: {
          type: Boolean,
          default: false,
        },
        type: {
          type: String,
          enum: ["payment", "invoice_link", "company_info"],
          default: "payment",
        },
        size: {
          type: Number,
          default: 150,
          min: 50,
          max: 500,
        },
      },

      // Number format
      numberFormat: {
        prefix: {
          type: String,
          default: "INV-",
        },
        dateFormat: {
          type: String,
          default: "YYYYMMDD",
        },
        sequence: {
          type: String,
          default: "NNNNNN",
        },
      },
    },

    // Email Settings
    email: {
      // SMTP Configuration
      smtp: {
        host: String,
        port: Number,
        secure: Boolean,
        username: String,
        password: String, // Should be encrypted
      },

      // Default sender
      from: {
        name: String,
        email: String,
      },

      // Templates
      templates: [emailTemplateSchema],
    },

    // Tax Configuration
    taxes: [taxConfigSchema],

    // Payment Gateways
    payments: {
      gateways: [paymentGatewaySchema],
      currency: {
        type: String,
        default: "INR",
        enum: ["INR", "USD", "EUR"],
      },
      acceptCOD: {
        type: Boolean,
        default: true,
      },
      codCharges: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // Shipping Configuration
    shipping: {
      freeShippingThreshold: {
        type: Number,
        default: 500,
        min: 0,
      },
      defaultCharge: {
        type: Number,
        default: 50,
        min: 0,
      },
      zones: [
        {
          name: String,
          pincodes: [String],
          charge: Number,
          estimatedDays: Number,
        },
      ],
    },

    // Order Configuration
    orders: {
      // Order statuses
      statuses: [
        {
          key: String,
          label: String,
          color: String,
          emailTemplate: String,
          smsTemplate: String,
        },
      ],

      // Auto-cancellation
      autoCancelAfterDays: {
        type: Number,
        default: 7,
        min: 1,
      },

      // Return policy
      returnPolicy: {
        enabled: {
          type: Boolean,
          default: true,
        },
        daysLimit: {
          type: Number,
          default: 30,
          min: 1,
        },
        conditions: {
          type: String,
          trim: true,
        },
      },
    },

    // Notification Settings
    notifications: {
      // Admin notifications
      admin: {
        newOrder: {
          type: Boolean,
          default: true,
        },
        lowStock: {
          type: Boolean,
          default: true,
        },
        newUser: {
          type: Boolean,
          default: false,
        },
      },

      // Customer notifications
      customer: {
        orderConfirmation: {
          type: Boolean,
          default: true,
        },
        statusUpdates: {
          type: Boolean,
          default: true,
        },
        shipmentTracking: {
          type: Boolean,
          default: true,
        },
        invoiceGenerated: {
          type: Boolean,
          default: true,
        },
      },
    },

    // Localization
    localization: {
      defaultLocale: {
        type: String,
        default: "en-IN",
      },
      timezone: {
        type: String,
        default: "Asia/Kolkata",
      },
      dateFormat: {
        type: String,
        default: "DD/MM/YYYY",
      },
      timeFormat: {
        type: String,
        default: "HH:mm",
      },
    },

    // Security Settings
    security: {
      // Login attempts
      maxLoginAttempts: {
        type: Number,
        default: 5,
      },
      lockoutDuration: {
        type: Number,
        default: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
      },

      // Password policy
      passwordPolicy: {
        minLength: {
          type: Number,
          default: 8,
        },
        requireUppercase: {
          type: Boolean,
          default: true,
        },
        requireNumbers: {
          type: Boolean,
          default: true,
        },
        requireSpecialChars: {
          type: Boolean,
          default: false,
        },
      },

      // Session settings
      sessionTimeout: {
        type: Number,
        default: 24 * 60 * 60 * 1000, // 24 hours
      },
    },

    // Analytics & Tracking
    analytics: {
      googleAnalytics: {
        trackingId: String,
        enabled: Boolean,
      },
      facebookPixel: {
        pixelId: String,
        enabled: Boolean,
      },
    },

    // Maintenance Mode
    maintenance: {
      enabled: {
        type: Boolean,
        default: false,
      },
      message: {
        type: String,
        trim: true,
      },
      allowedIPs: [String],
    },

    // Last updated tracking
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastUpdatedByName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get settings (singleton)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findById("settings");

  if (!settings) {
    // Create default settings if none exist
    settings = await this.create({
      _id: "settings",
      company: {
        name: "Urban Hub",
        email: "admin@urbanhub.com",
        phone: "+91-9999999999",
        address: {
          addressLine1: "123 Business Street",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "India",
        },
      },
      invoice: {
        termsAndConditions:
          "1. Payment is due within 30 days of invoice date.\n2. Late payments may incur additional charges.\n3. Goods once sold will not be taken back.",
        defaultNotes: "Thank you for your business!",
      },
    });
  }

  return settings;
};

// Method to update settings
settingsSchema.methods.updateSettings = function (updates, adminId, adminName) {
  Object.assign(this, updates);
  this.lastUpdatedBy = adminId;
  this.lastUpdatedByName = adminName;
  return this.save();
};

// Method to get email template
settingsSchema.methods.getEmailTemplate = function (templateName) {
  return this.email.templates.find(
    (template) => template.name === templateName && template.isActive
  );
};

// Method to get active tax rates
settingsSchema.methods.getActiveTaxes = function () {
  return this.taxes.filter((tax) => tax.isActive);
};

// Method to get default tax
settingsSchema.methods.getDefaultTax = function () {
  return this.taxes.find((tax) => tax.isDefault && tax.isActive);
};

// Method to get active payment gateways
settingsSchema.methods.getActivePaymentGateways = function () {
  return this.payments.gateways.filter((gateway) => gateway.isActive);
};

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;

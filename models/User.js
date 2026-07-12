const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user"
    },

    plan: {
  type: String,
  enum: ["free", "starter", "pro", "agent"],
  default: "free"
    },
planExpiresAt: {
  type: Date
},

// 🔒 Prevent duplicate Razorpay webhook processing
lastPaymentId: {
  type: String
},


    automationUsage: {
usage: {
  aiReplies: {
    type: Number,
    default: 0
  },

  aiQualification: {
    type: Number,
    default: 0
  },

  followUps: {
    type: Number,
    default: 0
  },

  resetAt: {
    type: Date,
    default: () => {
      const now = new Date();

      return new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );
    }
  }
},
      count: {
        type: Number,
        default: 0
      },
      resetAt: {
        type: Date,
        default: () => {
          const now = new Date();
          return new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            1
          );
        }
      }
    },

    isActive: {
      type: Boolean,
      default: true
  },
  // ✅ ADD THIS INSIDE MAIN OBJECT
    lastLogin: {
      type: Date
    },
businessName: {
  type: String,
  trim: true
},

businessType: {
  type: String,
  trim: true
},

offer: {
  type: String,
  trim: true
},

knowledgeBase: {
  type: String,
  default: ""
},
tone: {
  type: String,
  default: ""
},

services: {
  type: String,
  default: ""
},

faq: {
  type: String,
  default: ""
},

aiSetupCompleted: {
  type: Boolean,
  default: false
},

businessInfo: {
  pricing: String,
  services: String,
  timings: String,
  faqs: String,
  policies: String,
  offers: String
},

// WhatsApp Cloud API
whatsapp: {
  connected: {
    type: Boolean,
    default: false
  },

  businessId: {
    type: String,
    default: ""
  },

  businessAccountId: {
    type: String,
    default: ""
  },

  wabaId: {
    type: String,
    default: ""
  },

  phoneNumberId: {
    type: String,
    default: ""
  },

  phoneNumber: {
    type: String,
    default: ""
  },

  accessToken: {
    type: String,
    default: ""
  },

  verifyToken: {
    type: String,
    default: ""
  },

  displayName: {
    type: String,
    default: ""
  },

  connectedAt: {
    type: Date
  },

  lastSyncedAt: {
    type: Date
  }
},

  },

  {
    timestamps: true
  }
);


module.exports = mongoose.model("User", UserSchema);

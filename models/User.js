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

    resetPasswordToken: {
      type: String,
      select: false
    },

    resetPasswordExpires: {
      type: Date,
      select: false
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user"
    },

    workspaceOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    plan: {
  type: String,
  enum: ["free", "starter", "pro", "agent"],
  default: "free"
    },
planExpiresAt: {
  type: Date
},

freeTrialUsed: {
  type: Boolean,
  default: true
},

// 🔒 Prevent duplicate Razorpay webhook processing
lastPaymentId: {
  type: String
},

processedPaymentIds: {
  type: [String],
  default: [],
  select: false
},

aiReplyCredits: {
  type: Number,
  default: 0,
  min: 0
},

billingHistory: {
  type: [
    {
      paymentId: String,
      type: {
        type: String,
        enum: ["plan", "ai_reply_pack"]
      },
      plan: String,
      aiReplies: Number,
      amount: Number,
      currency: String,
      processedAt: Date
    }
  ],
  default: []
},

supportAssistantUsage: {
  day: {
    type: String,
    default: null
  },
  count: {
    type: Number,
    default: 0,
    min: 0
  }
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

facebookLeadAds: {
  connectedAt: Date,
  pages: [
    {
      pageId: {
        type: String,
        required: true
      },
      pageName: {
        type: String,
        default: ""
      },
      pageAccessToken: {
        type: String,
        select: false
      },
      connectedAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
},

  },

  {
    timestamps: true
  }
);


module.exports = mongoose.model("User", UserSchema);

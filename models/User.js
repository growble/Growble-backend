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
      enum: ["free", "starter", "pro"],
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

businessInfo: {
  pricing: String,
  services: String,
  timings: String,
  faqs: String,
  policies: String,
  offers: String
},

whatsappPhoneId:String,
whatsappToken:String,
verifyToken:String,

  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model("User", UserSchema);

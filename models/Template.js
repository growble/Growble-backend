const mongoose = require("mongoose");

const TemplateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  templates: {
    new: String,
    contacted: String,
    interested: String,
    closed: String,
    lost: String
  }
});

module.exports = mongoose.model("Template", TemplateSchema);
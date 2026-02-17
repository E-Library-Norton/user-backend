// ============================================
// FILE: src/models/index.js
// ============================================

const User = require("./User");
const Role = require("./Role");
const Permission = require("./Permission");
const Thesis = require("./Thesis");
const Publication = require("./Publication");
const Journal = require("./Journal");
const Category = require("./Category");

// Export all models
module.exports = {
  User,
  Role,
  Permission,
  Thesis,
  Publication,
  Journal,
  Category,
};

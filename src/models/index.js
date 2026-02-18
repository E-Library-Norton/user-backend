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

const models = { User, Role, Permission, Thesis, Publication, Journal, Category };

// Run all association definitions
Object.values(models).forEach((model) => {
  if (model.associate) model.associate(models);
});

// Export all models
module.exports = models;

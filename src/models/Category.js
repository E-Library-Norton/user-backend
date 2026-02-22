// ============================================
// FILE: src/models/Category.js
// ============================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    nameKh: {
      type: DataTypes.STRING(255),
      field: "name_kh",
    },
  },
  {
    tableName: "categories",
    timestamps: false,
  }
);

module.exports = Category;

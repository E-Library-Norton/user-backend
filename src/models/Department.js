// src/models/Role.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Department = sequelize.define(
  "Department",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nameKh: {
      type: DataTypes.STRING(255),
      field: 'name_kh',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "departments",
    timestamps: false,
  }
);

module.exports = Department;
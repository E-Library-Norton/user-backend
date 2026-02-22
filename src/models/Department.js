// src/models/Role.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Department = sequelize.define(
  "Department",
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    name: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    nameKh: {
      type:  DataTypes.STRING(255),
      field: 'name_kh',
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "departments",
    timestamps: false,
  }
);

module.exports = Department;
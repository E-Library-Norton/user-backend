// src/models/Role.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MaterialType = sequelize.define(
  "MaterialType",
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    name: {
      type:      DataTypes.STRING(100),
      allowNull: false,
    },
    nameKh: {
      type:  DataTypes.STRING(100),
      field: 'name_kh',
    },
  },
  {
    tableName: "material_types",
    timestamps: false,
  }
);

module.exports = MaterialType;
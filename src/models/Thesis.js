// ============================================
// FILE: src/models/Thesis.js (UPDATED)
// ============================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Thesis = sequelize.define(
  "Thesis",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    titleKh: {
      type: DataTypes.STRING(500),
      field: "title_kh",
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    authorKh: {
      type: DataTypes.STRING,
      field: "author_kh",
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1900,
        max: new Date().getFullYear() + 1,
      },
    },
    coverUrl: {
      type: DataTypes.STRING(500),
      field: "cover_url",
    },
    pdfUrl: {
      type: DataTypes.STRING(500),
      field: "pdf_url",
    },
    description: {
      type: DataTypes.TEXT,
    },
    descriptionKh: {
      type: DataTypes.TEXT,
      field: "description_kh",
    },
    pages: {
      type: DataTypes.INTEGER,
    },
    fileSize: {
      type: DataTypes.STRING(20),
      field: "file_size",
    },
    downloads: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("published", "draft", "archived"),
      defaultValue: "draft",
    },
  },
  {
    tableName: "thesis",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["title"],
      },
      {
        fields: ["author"],
      },
      {
        fields: ["year"],
      },
    ],
  }
);

module.exports = Thesis;
// ============================================
// FILE: src/models/Thesis.js (UPDATED)
// ============================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Book = sequelize.define(
  "Book",
  {
    id: {
      type:          DataTypes.BIGINT,
      primaryKey:    true,
      autoIncrement: true,
    },
    title: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    titleKh: {
      type:  DataTypes.STRING(500),
      field: 'title_kh',
    },
    isbn: {
      type:   DataTypes.STRING(20),
      unique: true,
    },
    publicationYear: {
      type:  DataTypes.INTEGER,
      field: 'publication_year',
    },
    description: {
      type: DataTypes.TEXT,
    },
    coverUrl: {
      type:  DataTypes.STRING(500),
      field: 'cover_url',
    },
    pdfUrl: {
      type:  DataTypes.STRING(500),
      field: 'pdf_url',
    },
    pages: {
      type: DataTypes.INTEGER,
    },
    views: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    publisherId: {
      type:  DataTypes.INTEGER,
      field: 'publisher_id',
    },
    categoryId: {
      type:  DataTypes.INTEGER,
      field: 'category_id',
    },
    departmentId: {
      type:  DataTypes.INTEGER,
      field: 'department_id',
    },
    typeId: {
      type:  DataTypes.INTEGER,
      field: 'type_id',
    },
    isActive: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
      field:        'is_active',
    },
    isDeleted: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
      field:        'is_deleted',
    },
  },
  {
    tableName: "books",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Book;
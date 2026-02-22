// ============================================
// FILE: src/controllers/categoryController.js
// ============================================

const Category = require("../models/Category");
const { ConflictError } = require("../utils/errors");
const ResponseFormatter = require("../utils/responseFormatter");

class CategoryController {
  static async getAll(req, res, next) {
    try {
      const categories = await Category.findAll({
        order: [["name", "ASC"]],
      });
      return ResponseFormatter.success(res, categories);
    } catch (error) {
      next(error);
    }
  }


  static async getById(req, res, next) {
    try {
      const category = await Category.findByPk(req.params.id);
      if (!category) {
        return ResponseFormatter.notFound(res, "Category not found");
      }
      return ResponseFormatter.success(res, category);
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const { name } = req.body;
      const existing = await Category.findOne({ where: { name } });
      if (existing) throw new ConflictError(`Category '${name}' already exists`);
      const category = await Category.create(req.body);
      return ResponseFormatter.success(
        res,
        category,
        "Category created successfully",
        201
      );
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const category = await Category.findByPk(req.params.id);
      if (!category) {
        return ResponseFormatter.notFound(res, "Category not found");
      }

      await category.update(req.body);
      return ResponseFormatter.success(
        res,
        category,
        "Category updated successfully",
        200
      );
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const category = await Category.findByPk(req.params.id);
      if (!category) {
        return ResponseFormatter.notFound(res, "Category not found");
      }

      await category.destroy();
      return ResponseFormatter.noContent(res, "Category deleted successfully");
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CategoryController;

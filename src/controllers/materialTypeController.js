// controllers/materialType.controller.js
const { Op } = require('sequelize');
const { MaterialType } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { ValidationError, NotFoundError } = require('../utils/errors');

class MaterialTypeController {
  static async getAll(req, res, next) {
    try {
      const types = await MaterialType.findAll({ order: [['name', 'ASC']] });
      return ResponseFormatter.success(res, types);
    } catch (err) { next(err); }
  }

  static async getById(req, res, next) {
    try {
      const type = await MaterialType.findByPk(req.params.id);
      if (!type) throw new NotFoundError('Material type not found');
      return ResponseFormatter.success(res, type);
    } catch (err) { next(err); }
  }

  static async create(req, res, next) {
    try {
      const { name, nameKh } = req.body;
      if (!name) throw new ValidationError('Name is required');
      const type = await MaterialType.create({ name, nameKh });
      return ResponseFormatter.success(res, type, 'Material type created successfully', 201);
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const type = await MaterialType.findByPk(req.params.id);
      if (!type) throw new NotFoundError('Material type not found');
      const { name, nameKh } = req.body;
      await type.update({ ...(name !== undefined && { name }), ...(nameKh !== undefined && { nameKh }) });
      return ResponseFormatter.success(res, type, 'Material type updated successfully');
    } catch (err) { next(err); }
  }

  static async delete(req, res, next) {
    try {
      const type = await MaterialType.findByPk(req.params.id);
      if (!type) throw new NotFoundError('Material type not found');
      await type.destroy();
      return ResponseFormatter.noContent(res, null, 'Material type deleted successfully');
    } catch (err) { next(err); }
  }
}

module.exports = MaterialTypeController;
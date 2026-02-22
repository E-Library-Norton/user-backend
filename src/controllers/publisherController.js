// controllers/publisher.controller.js
const { Op } = require('sequelize');
const { Publisher } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { ValidationError, NotFoundError } = require('../utils/errors');

class PublisherController {

  static async getAll(req, res, next) {
    try {
      const { search = '' } = req.query;
      const where = search
        ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { nameKh: { [Op.iLike]: `%${search}%` } }] }
        : {};
      const publishers = await Publisher.findAll({ where, order: [['name', 'ASC']] });
      return ResponseFormatter.success(res, publishers);
    } catch (err) { next(err); }
  }

  static async getById(req, res, next) {
    try {
      const publisher = await Publisher.findByPk(req.params.id);
      if (!publisher) throw new NotFoundError('Publisher not found');
      return ResponseFormatter.success(res, publisher);
    } catch (err) { next(err); }
  }

  static async create(req, res, next) {
    try {
      const { name, nameKh, address, contactEmail } = req.body;
      if (!name) throw new ValidationError('Name is required');
      const publisher = await Publisher.create({ name, nameKh, address, contactEmail });
      return ResponseFormatter.success(res, publisher, 'Publisher created successfully', 201);
    } catch (err) { next(err); }
  }

  static async update(req, res, next) {
    try {
      const publisher = await Publisher.findByPk(req.params.id);
      if (!publisher) throw new NotFoundError('Publisher not found');
      const { name, nameKh, address, contactEmail } = req.body;
      await publisher.update({
        ...(name !== undefined && { name }),
        ...(nameKh !== undefined && { nameKh }),
        ...(address !== undefined && { address }),
        ...(contactEmail !== undefined && { contactEmail }),
      });
      return ResponseFormatter.success(res, publisher, 'Publisher updated successfully');
    } catch (err) { next(err); }
  }

  static async delete(req, res, next) {
    try {
      const publisher = await Publisher.findByPk(req.params.id);
      if (!publisher) throw new NotFoundError('Publisher not found');
      await publisher.destroy();
      return ResponseFormatter.noContent(res, null, 'Publisher deleted successfully');
    } catch (err) { next(err); }
  }
}

module.exports = PublisherController;
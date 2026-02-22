// controllers/author.controller.js
const { Op } = require('sequelize');
const { Author, Book } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { ValidationError, NotFoundError } = require('../utils/errors');

class AuthorController {

  // GET /api/authors
  static async getAll(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const where = search
        ? { [Op.or]: [{ name: { [Op.iLike]: `%${search}%` } }, { nameKh: { [Op.iLike]: `%${search}%` } }] }
        : {};

      const { count, rows } = await Author.findAndCountAll({
        where, order: [['name', 'ASC']],
        limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
      });
      return ResponseFormatter.success(res, {
        authors: rows, total: count, page: Number(page),
        limit: Number(limit), totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }

  // GET /api/authors/:id
  static async getById(req, res, next) {
    try {
      const author = await Author.findByPk(req.params.id, {
        include: [{ model: Book, as: 'Books', attributes: ['id', 'title', 'coverUrl', 'publicationYear'] }],
      });
      if (!author) throw new NotFoundError('Author not found');
      return ResponseFormatter.success(res, author);
    } catch (err) { next(err); }
  }

  // POST /api/authors
  static async create(req, res, next) {
    try {
      const { name, nameKh, biography, website } = req.body;
      if (!name) throw new ValidationError('Name is required');
      const author = await Author.create({ name, nameKh, biography, website });
      return ResponseFormatter.success(res, author, 'Author created successfully', 201);
    } catch (err) { next(err); }
  }

  // PUT /api/authors/:id
  static async update(req, res, next) {
    try {
      const author = await Author.findByPk(req.params.id);
      if (!author) throw new NotFoundError('Author not found');
      const { name, nameKh, biography, website } = req.body;
      await author.update({ ...(name !== undefined && { name }), ...(nameKh !== undefined && { nameKh }), ...(biography !== undefined && { biography }), ...(website !== undefined && { website }) });
      return ResponseFormatter.success(res, author, 'Author updated successfully');
    } catch (err) { next(err); }
  }

  // DELETE /api/authors/:id
  static async delete(req, res, next) {
    try {
      const author = await Author.findByPk(req.params.id);
      if (!author) throw new NotFoundError('Author not found');
      await author.destroy();
      return ResponseFormatter.noContent(res, null, 'Author deleted successfully');
    } catch (err) { next(err); }
  }
}

module.exports = AuthorController;
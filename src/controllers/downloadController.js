// controllers/download.controller.js
const { Op } = require('sequelize');
const { Download, Book, User } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { NotFoundError } = require('../utils/errors');

class DownloadController {

  // POST /api/books/:id/download — record a download
  static async recordDownload(req, res, next) {
    try {
      const book = await Book.findOne({ where: { id: req.params.id, isDeleted: false, isActive: true } });
      if (!book) throw new NotFoundError('Book not found');

      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const download = await Download.create({
        userId: req.user.id,
        bookId: book.id,
        ipAddress,
      });

      return ResponseFormatter.success(res, { downloadId: download.id }, 'Download recorded successfully', 201);
    } catch (err) { next(err); }
  }

  // GET /api/downloads — admin: all downloads with pagination + filters
  static async getAll(req, res, next) {
    try {
      const { page = 1, limit = 10, userId, bookId, from, to } = req.query;
      const where = {};

      if (userId) where.userId = userId;
      if (bookId) where.bookId = bookId;
      if (from || to) {
        where.downloadedAt = {};
        if (from) where.downloadedAt[Op.gte] = new Date(from);
        if (to) where.downloadedAt[Op.lte] = new Date(to);
      }

      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Download.findAndCountAll({
        where,
        include: [
          { model: User, as: 'User', attributes: ['id', 'username', 'email', 'studentId'] },
          { model: Book, as: 'Book', attributes: ['id', 'title', 'isbn'] },
        ],
        order: [['downloadedAt', 'DESC']],
        limit: Number(limit),
        offset,
      });

      return ResponseFormatter.success(res, {
        downloads: rows,
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }

  // GET /api/downloads/my — current user's download history
  static async getMyDownloads(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows } = await Download.findAndCountAll({
        where: { userId: req.user.id },
        include: [{ model: Book, as: 'Book', attributes: ['id', 'title', 'isbn', 'coverUrl'] }],
        order: [['downloadedAt', 'DESC']],
        limit: Number(limit),
        offset,
      });

      return ResponseFormatter.success(res, {
        downloads: rows, total: count,
        page: Number(page), totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }

  // GET /api/downloads/stats — top downloaded books + totals
  static async getStats(req, res, next) {
    try {
      const { fn, col, literal } = require('sequelize');

      const topBooks = await Download.findAll({
        attributes: ['bookId', [fn('COUNT', col('Download.id')), 'downloadCount']],
        include: [{ model: Book, as: 'Book', attributes: ['id', 'title', 'coverUrl'] }],
        group: ['bookId', 'Book.id'],
        order: [[literal('downloadCount'), 'DESC']],
        limit: 10,
      });

      const totalDownloads = await Download.count();

      return ResponseFormatter.success(res, { totalDownloads, topBooks });
    } catch (err) { next(err); }
  }
}

module.exports = DownloadController;
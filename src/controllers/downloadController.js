// controllers/downloadController.js
const path                     = require('path');
const { Readable }             = require('stream');
const { Op }                   = require('sequelize');
const { Download, Book, User } = require('../models');
const ResponseFormatter        = require('../utils/responseFormatter');
const { NotFoundError }        = require('../utils/errors');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Extract the original filename from the Cloudinary URL.
// e.g. ".../raw/upload/books/pdfs/cafe.pdf" → "cafe.pdf"
function pdfFilename(pdfUrl) {
  try {
    return path.basename(new URL(pdfUrl).pathname); // "cafe.pdf"
  } catch {
    return 'file.pdf';
  }
}

// Fetch the Cloudinary URL and pipe it to the Express response.
async function pipeFromCloudinary(pdfUrl, res, disposition) {
  const cloudRes = await fetch(pdfUrl);

  if (!cloudRes.ok || !cloudRes.body) {
    return false; // caller handles error
  }

  const filename = pdfFilename(pdfUrl);
  const encoded  = encodeURIComponent(filename);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"; filename*=UTF-8''${encoded}`);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const contentLength = cloudRes.headers.get('content-length');
  if (contentLength) res.setHeader('Content-Length', contentLength);

  await new Promise((resolve, reject) => {
    const readable = Readable.fromWeb(cloudRes.body);
    readable.on('error', reject);
    res.on('error', reject);
    res.on('finish', resolve);
    readable.pipe(res);
  });

  return true;
}

// ── Controller ────────────────────────────────────────────────────────────────

class DownloadController {

  /**
   * GET /api/books/:id/stream
   * Pipes the PDF inline so the browser renders it (e.g. in an <iframe>).
   * Content-Disposition: inline; filename="cafe.pdf"
   * Does NOT record a Download row.
   */
  static async streamPdf(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'pdfUrl'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

      const ok = await pipeFromCloudinary(book.pdfUrl, res, 'inline');
      if (!ok && !res.headersSent) {
        return ResponseFormatter.error(res, 'Could not fetch PDF from storage', 502, 'FETCH_ERROR');
      }
    } catch (err) {
      if (res.headersSent) res.destroy?.();
      else next(err);
    }
  }

  /**
   * GET /api/books/:id/download
   * Records a Download row, increments book.downloads, then pipes the PDF
   * as an attachment so the browser opens "Save As: cafe.pdf".
   * Content-Disposition: attachment; filename="cafe.pdf"
   */
  static async recordDownload(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'title', 'pdfUrl', 'downloads'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const [download] = await Promise.all([
        Download.create({ userId: req.user.id, bookId: book.id, ipAddress }),
        book.increment('downloads'),
      ]);

      res.setHeader('X-Download-Id', download.id);

      const ok = await pipeFromCloudinary(book.pdfUrl, res, 'attachment');
      if (!ok && !res.headersSent) {
        return ResponseFormatter.error(res, 'Could not fetch PDF from storage', 502, 'FETCH_ERROR');
      }
    } catch (err) {
      if (res.headersSent) res.destroy?.();
      else next(err);
    }
  }

  // GET /api/downloads
  static async getAll(req, res, next) {
    try {
      const { page = 1, limit = 10, userId, bookId, from, to } = req.query;
      const where = {};
      if (userId) where.userId = userId;
      if (bookId) where.bookId = bookId;
      if (from || to) {
        where.downloadedAt = {};
        if (from) where.downloadedAt[Op.gte] = new Date(from);
        if (to)   where.downloadedAt[Op.lte] = new Date(to);
      }

      const offset = (Number(page) - 1) * Number(limit);
      const { count, rows } = await Download.findAndCountAll({
        where,
        include: [
          { model: User, as: 'User', attributes: ['id', 'username', 'email', 'studentId'] },
          { model: Book, as: 'Book', attributes: ['id', 'title', 'isbn', 'downloads'] },
        ],
        order:  [['downloadedAt', 'DESC']],
        limit:  Number(limit),
        offset,
      });

      return ResponseFormatter.success(res, {
        downloads: rows, total: count,
        page: Number(page), limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }

  // GET /api/downloads/my
  static async getMyDownloads(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows } = await Download.findAndCountAll({
        where:   { userId: req.user.id },
        include: [{ model: Book, as: 'Book', attributes: ['id', 'title', 'isbn', 'coverUrl', 'downloads'] }],
        order:   [['downloadedAt', 'DESC']],
        limit:   Number(limit),
        offset,
      });

      return ResponseFormatter.success(res, {
        downloads: rows, total: count,
        page: Number(page), totalPages: Math.ceil(count / Number(limit)),
      });
    } catch (err) { next(err); }
  }

  // GET /api/downloads/stats
  static async getStats(_req, res, next) {
    try {
      const { fn, col } = require('sequelize');
      const countExpr   = fn('COUNT', col('Download.id'));

      const [topBooks, totalDownloads] = await Promise.all([
        Download.findAll({
          attributes: [
            [col('Download.book_id'), 'bookId'],
            [countExpr, 'downloadCount'],
          ],
          include: [{ model: Book, as: 'Book', attributes: ['id', 'title', 'coverUrl', 'downloads'] }],
          group:   [col('Download.book_id'), col('Book.id')],
          order:   [[countExpr, 'DESC']],
          limit:   10,
        }),
        Download.count(),
      ]);

      return ResponseFormatter.success(res, { totalDownloads, topBooks });
    } catch (err) { next(err); }
  }
}

module.exports = DownloadController;

// controllers/downloadController.js
const https                    = require('https');
const http                     = require('http');
const { Op }                   = require('sequelize');
const { Download, Book, User } = require('../models');
const ResponseFormatter        = require('../utils/responseFormatter');
const { NotFoundError }        = require('../utils/errors');

// ─────────────────────────────────────────────────────────────────────────────
// proxyStream — fetch a URL server-side and pipe it to the Express response.
// Follows HTTP redirects (Cloudinary raw URLs sometimes redirect once).
// ─────────────────────────────────────────────────────────────────────────────

function fetchWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;

    lib.get(url, (res) => {
      // Follow redirects (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        res.resume(); // drain the body
        return fetchWithRedirect(res.headers.location, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }
      resolve(res);
    }).on('error', reject);
  });
}

function safeFilename(title) {
  return `${title.replace(/[^\w\s\-]/g, '').trim()}.pdf`;
}

async function proxyStream(cloudinaryUrl, res, disposition, filename) {
  const upstream = await fetchWithRedirect(cloudinaryUrl);

  if (upstream.statusCode !== 200) {
    if (!res.headersSent) {
      res.status(upstream.statusCode || 502).json({
        success: false,
        error: { message: `Could not fetch file (status ${upstream.statusCode})` },
      });
    }
    upstream.resume();
    return;
  }

  const encodedName = encodeURIComponent(filename);

  res.setHeader('Content-Type',        upstream.headers['content-type'] || 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"; filename*=UTF-8''${encodedName}`);
  res.setHeader('Cache-Control',       'public, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (upstream.headers['content-length']) {
    res.setHeader('Content-Length', upstream.headers['content-length']);
  }

  upstream.pipe(res);
  await new Promise((resolve, reject) => {
    upstream.on('end',   resolve);
    upstream.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

class DownloadController {

  /**
   * GET /api/books/:id/stream?token=<jwt>
   * Stream the PDF inline so the browser can render it.
   * Requires login via ?token= or Authorization header.
   * Does NOT record a Download row (reading ≠ downloading).
   */
  static async streamPdf(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'title', 'pdfUrl'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

      await proxyStream(book.pdfUrl, res, 'inline', safeFilename(book.title));
    } catch (err) { next(err); }
  }

  /**
   * GET /api/books/:id/download?token=<jwt>
   * Records a Download row, increments book.downloads counter,
   * then streams the PDF as an attachment ("Save As" dialog).
   */
  static async recordDownload(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'title', 'pdfUrl', 'downloads'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

      // Record the event and increment counter in parallel
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      const [download] = await Promise.all([
        Download.create({ userId: req.user.id, bookId: book.id, ipAddress }),
        book.increment('downloads'),
      ]);

      res.setHeader('X-Download-Id', download.id);

      await proxyStream(book.pdfUrl, res, 'attachment', safeFilename(book.title));
    } catch (err) { next(err); }
  }

  // GET /api/downloads  — admin: all downloads
  static async getAll(req, res, next) {
    try {
      const { page = 1, limit = 10, userId, bookId, from, to } = req.query;
      const where  = {};

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

  // GET /api/downloads/my  — current user's history
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

  // GET /api/downloads/stats  — top books + total count
  static async getStats(req, res, next) {
    try {
      const { fn, col, literal } = require('sequelize');

      const [topBooks, totalDownloads] = await Promise.all([
        Download.findAll({
          attributes: ['bookId', [fn('COUNT', col('Download.id')), 'downloadCount']],
          include:    [{ model: Book, as: 'Book', attributes: ['id', 'title', 'coverUrl', 'downloads'] }],
          group:      ['bookId', 'Book.id'],
          order:      [[literal('downloadCount'), 'DESC']],
          limit:      10,
        }),
        Download.count(),
      ]);

      return ResponseFormatter.success(res, { totalDownloads, topBooks });
    } catch (err) { next(err); }
  }
}

module.exports = DownloadController;
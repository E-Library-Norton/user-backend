// controllers/downloadController.js
const https                    = require('https');
const http                     = require('http');
const { Op }                   = require('sequelize');
const { Download, Book, User } = require('../models');
const cloudinary               = require('../config/cloudinary');
const ResponseFormatter        = require('../utils/responseFormatter');
const { NotFoundError }        = require('../utils/errors');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────


function extractPublicId(secureUrl) {
  if (!secureUrl) return null;
  // Remove everything up to and including "/upload/" (and optional version segment)
  const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? match[1] : null;
}

/**
 * Generate a time-limited Cloudinary signed URL.
 * This works even when the Cloudinary account has strict access controls.
 */
function signedUrl(publicId, resourceType = 'raw') {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    sign_url:      true,
    expires_at:    Math.floor(Date.now() / 1000) + 3600, // valid 1 hour
    type:          'upload',
    secure:        true,
  });
}

/**
 * Fetch a URL server-side, following HTTP redirects.
 * FIX: Added explicit 30s timeout — prevents hanging indefinitely when
 * Cloudinary or any upstream host is slow / unreachable.
 */
function fetchWithRedirect(url, maxRedirects = 5, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;

    const req = lib.get(url, (res) => {
      if (
        [301, 302, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        maxRedirects > 0
      ) {
        res.resume(); // drain before following redirect
        return fetchWithRedirect(res.headers.location, maxRedirects - 1, timeoutMs)
          .then(resolve)
          .catch(reject);
      }
      resolve(res);
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`PDF fetch timed out after ${timeoutMs}ms`));
    });
  });
}

/**
 * Stream a PDF from Cloudinary (or any URL) to the Express response.
 */
async function proxyPdf(pdfUrl, res, disposition) {
  const publicId     = extractPublicId(pdfUrl);
  const resourceType = pdfUrl.includes('/image/') ? 'image' : 'raw';
  const fetchUrl     = publicId ? signedUrl(publicId, resourceType) : pdfUrl;

  const upstream = await fetchWithRedirect(fetchUrl);

  if (upstream.statusCode !== 200) {
    upstream.resume(); // drain to free the socket
    if (!res.headersSent) {
      res.status(upstream.statusCode || 502).json({
        success: false,
        error: { message: `Could not fetch PDF (upstream status ${upstream.statusCode})` },
      });
    }
    return;
  }

  const filename    = disposition === 'inline' ? 'preview.pdf' : 'document.pdf';
  const encodedName = encodeURIComponent(filename);

  res.setHeader('Content-Type',                 upstream.headers['content-type'] || 'application/pdf');
  res.setHeader('Content-Disposition',          `${disposition}; filename="${filename}"; filename*=UTF-8''${encodedName}`);
  res.setHeader('Cache-Control',                'private, max-age=3600');
  res.setHeader('X-Content-Type-Options',       'nosniff');
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (upstream.headers['content-length']) {
    res.setHeader('Content-Length', upstream.headers['content-length']);
  }

  // FIX: register listeners FIRST, then call pipe() — avoids the race condition
  // where the stream ends before Promise constructor sets up listeners.
  await new Promise((resolve, reject) => {
    upstream.on('error', (err) => {
      if (!res.headersSent) {
        reject(err);
      } else {
        upstream.destroy();
        res.destroy();
        resolve(); // client already received data, silently close
      }
    });
    res.on('error', (err) => {
      upstream.destroy();
      reject(err);
    });
    res.on('finish', resolve); // fires when all data is flushed to the client

    upstream.pipe(res); // start streaming — AFTER listeners are attached
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

class DownloadController {

  /**
   * GET /api/books/:id/stream?token=<jwt>
   * Inline PDF preview. Token via ?token= OR Authorization header.
   * Does NOT create a Download record.
   */
  static async streamPdf(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'title', 'pdfUrl'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

      await proxyPdf(book.pdfUrl, res, 'inline');
    } catch (err) {
      if (res.headersSent) {
        res.destroy?.();
      } else {
        next(err);
      }
    }
  }

  /**
   * GET /api/books/:id/download?token=<jwt>
   * Records download, increments counter, streams PDF as attachment.
   */
  static async recordDownload(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'title', 'pdfUrl', 'downloads'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

      // FIX: Stream the PDF FIRST — DB operations must not block or break the download.
      // If Download.create() fails, the user still receives the file.
      await proxyPdf(book.pdfUrl, res, 'attachment');

      // Fire-and-forget: record the download after streaming succeeds
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      Download.create({ userId: req.user.id, bookId: book.id, ipAddress })
        .then(() => book.increment('downloads').catch(console.error))
        .catch((err) => console.error('Failed to record download:', err));

    } catch (err) {
      if (res.headersSent) {
        res.destroy?.();
      } else {
        next(err);
      }
    }
  }

  // GET /api/downloads — admin: all downloads
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

  // GET /api/downloads/my — current user's history
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

  // GET /api/downloads/stats — top books + total
  static async getStats(req, res, next) {
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

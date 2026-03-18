// controllers/downloadController.js
<<<<<<< HEAD
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
=======
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
 *
 * FIX 1: All event listeners are registered BEFORE pipe() is called to
 *        eliminate the race condition where 'end' fires before the Promise
 *        constructor runs (reproducible with very small / cached files).
 *
 * FIX 2: Listen for res 'finish' (data fully flushed to client) instead of
 *        upstream 'end' (source drained but TCP buffers may still be in-flight).
 *
 * FIX 3: Added 'Access-Control-Allow-Methods' header (was missing before).
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
>>>>>>> 5caed4a (feat: fix issues get pdf file)

class DownloadController {

  /**
<<<<<<< HEAD
   * GET /api/books/:id/stream
   * Pipes the PDF inline so the browser renders it (e.g. in an <iframe>).
   * Content-Disposition: inline; filename="cafe.pdf"
   * Does NOT record a Download row.
=======
   * GET /api/books/:id/stream?token=<jwt>
   * Inline PDF preview. Token via ?token= OR Authorization header.
   * Does NOT create a Download record.
>>>>>>> 5caed4a (feat: fix issues get pdf file)
   */
  static async streamPdf(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
<<<<<<< HEAD
        attributes: ['id', 'pdfUrl'],
=======
        attributes: ['id', 'title', 'pdfUrl'],
>>>>>>> 5caed4a (feat: fix issues get pdf file)
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

<<<<<<< HEAD
      const ok = await pipeFromCloudinary(book.pdfUrl, res, 'inline');
      if (!ok && !res.headersSent) {
        return ResponseFormatter.error(res, 'Could not fetch PDF from storage', 502, 'FETCH_ERROR');
      }
    } catch (err) {
      if (res.headersSent) res.destroy?.();
      else next(err);
=======
      await proxyPdf(book.pdfUrl, res, 'inline');
    } catch (err) {
      // FIX: once pipe() has started, headers are already sent — calling
      // next(err) would cause "Cannot set headers after they are sent".
      if (res.headersSent) {
        res.destroy?.();
      } else {
        next(err);
      }
>>>>>>> 5caed4a (feat: fix issues get pdf file)
    }
  }

  /**
<<<<<<< HEAD
   * GET /api/books/:id/download
   * Records a Download row, increments book.downloads, then pipes the PDF
   * as an attachment so the browser opens "Save As: cafe.pdf".
   * Content-Disposition: attachment; filename="cafe.pdf"
=======
   * GET /api/books/:id/download?token=<jwt>
   * Records download, increments counter, streams PDF as attachment.
>>>>>>> 5caed4a (feat: fix issues get pdf file)
   */
  static async recordDownload(req, res, next) {
    try {
      const book = await Book.findOne({
        where:      { id: req.params.id, isDeleted: false, isActive: true },
        attributes: ['id', 'title', 'pdfUrl', 'downloads'],
      });

      if (!book)        throw new NotFoundError('Book not found');
      if (!book.pdfUrl) return ResponseFormatter.error(res, 'No PDF available for this book', 404, 'NO_PDF');

<<<<<<< HEAD
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
=======
      // FIX: Stream the PDF FIRST — DB operations must not block or break the download.
      // If Download.create() fails, the user still receives the file.
      await proxyPdf(book.pdfUrl, res, 'attachment');

      // Fire-and-forget: record the download after streaming succeeds
      const ipAddress = req.ip || req.headers['x-forwarded-for'];
      Download.create({ userId: req.user.id, bookId: book.id, ipAddress })
        .then(() => book.increment('downloads').catch(console.error))
        .catch((err) => console.error('Failed to record download:', err));

    } catch (err) {
      // FIX: same as streamPdf — don't call next(err) after headers are sent
      if (res.headersSent) {
        res.destroy?.();
      } else {
        next(err);
      }
    }
  }

  // GET /api/downloads — admin: all downloads
>>>>>>> 5caed4a (feat: fix issues get pdf file)
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

<<<<<<< HEAD
  // GET /api/downloads/my
=======
  // GET /api/downloads/my — current user's history
>>>>>>> 5caed4a (feat: fix issues get pdf file)
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

<<<<<<< HEAD
  // GET /api/downloads/stats
  static async getStats(_req, res, next) {
=======
  // GET /api/downloads/stats — top books + total
  static async getStats(req, res, next) {
>>>>>>> 5caed4a (feat: fix issues get pdf file)
    try {
      const { fn, col } = require('sequelize');
      const countExpr   = fn('COUNT', col('Download.id'));

      const [topBooks, totalDownloads] = await Promise.all([
        Download.findAll({
<<<<<<< HEAD
          attributes: [
            [col('Download.book_id'), 'bookId'],
            [countExpr, 'downloadCount'],
          ],
          include: [{ model: Book, as: 'Book', attributes: ['id', 'title', 'coverUrl', 'downloads'] }],
          group:   [col('Download.book_id'), col('Book.id')],
          order:   [[countExpr, 'DESC']],
          limit:   10,
=======
          attributes: ['bookId', [fn('COUNT', col('Download.id')), 'downloadCount']],
          include:    [{ model: Book, as: 'Book', attributes: ['id', 'title', 'coverUrl', 'downloads'] }],
          group:      ['bookId', 'Book.id'],
          order:      [[literal('downloadCount'), 'DESC']],
          limit:      10,
>>>>>>> 5caed4a (feat: fix issues get pdf file)
        }),
        Download.count(),
      ]);

      return ResponseFormatter.success(res, { totalDownloads, topBooks });
    } catch (err) { next(err); }
  }
}

module.exports = DownloadController;

// routes/books.js
const router             = require('express').Router();
const BookController     = require('../controllers/bookController');
const DownloadController = require('../controllers/downloadController');
const ReviewController   = require('../controllers/reviewController');
const { authenticate, authorize, authenticateStream } = require('../middleware/auth');
const { uploadMulti, uploadScan }    = require('../middleware/upload');

// Public — anyone can browse
router.get ('/',    BookController.getAll);
router.post('/scan-search', uploadScan, BookController.scanSearch);
router.get ('/:id', BookController.getById);

// PDF access:
// GET  /:id/cover    → PUBLIC — redirects to presigned cover image URL
// GET  /:id/pdf-url  → REQUIRES login — returns a 1-hour presigned R2 URL (no proxy)
// GET  /:id/stream   → PUBLIC inline proxy-stream — no login needed to read
// GET  /:id/download → REQUIRES login — records download + serves as attachment
router.get('/:id/cover',    DownloadController.getCover);                            // ← public cover
router.get('/:id/pdf-url',  authenticate,        DownloadController.getPdfUrl);      // ← presigned URL
router.get('/:id/stream',   DownloadController.streamPdf);                           // ← public proxy
router.get('/:id/download', authenticateStream,  DownloadController.recordDownload); // ← auth proxy

// Admin stats for a book
router.get('/:id/downloads', authenticate, authorize('admin', 'librarian'), BookController.getDownloads);

// Librarian / Admin only — create / update / delete
// Files are pre-uploaded via POST /api/upload/single; coverUrl & pdfUrl passed as body fields
router.post  ('/',     authenticate, authorize('admin', 'librarian'), uploadMulti, BookController.create);
router.put   ('/:id',  authenticate, authorize('admin', 'librarian'), uploadMulti, BookController.update);
router.delete('/:id',  authenticate, authorize('admin'),              BookController.delete);

// ── Nested review routes for a book ─────────────────────────────────────────
// GET  /api/books/:bookId/reviews  — public
// POST /api/books/:bookId/reviews  — authenticated users
router.get ('/:bookId/reviews', ReviewController.getByBook);
router.post('/:bookId/reviews', authenticate, ReviewController.create);

module.exports = router;

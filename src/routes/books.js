// routes/books.js
const router             = require('express').Router();
const BookController     = require('../controllers/bookController');
const DownloadController = require('../controllers/downloadController');
const { authenticate, authorize, authenticateStream } = require('../middleware/auth');
const { uploadMulti }    = require('../middleware/upload');

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/',    BookController.getAll);
router.get('/:id', BookController.getById);

// ── PDF stream / download (token via ?token= OR Authorization header) ──────────
// GET /:id/stream   → inline preview  (for iframe / PDF viewer)
// GET /:id/download → attachment download + records in DB
router.get('/:id/stream',   authenticateStream, DownloadController.streamPdf);
router.get('/:id/download', authenticateStream, DownloadController.recordDownload);

// ── Admin / Librarian only ─────────────────────────────────────────────────────
router.get   ('/:id/downloads', authenticate, authorize('admin', 'librarian'), BookController.getDownloads);
router.post  ('/',              authenticate, authorize('admin', 'librarian'), uploadMulti, BookController.create);
router.put   ('/:id',           authenticate, authorize('admin', 'librarian'), uploadMulti, BookController.update);
router.delete('/:id',           authenticate, authorize('admin'),                           BookController.delete);

module.exports = router;
// routes/books.js
const router             = require('express').Router();
const BookController     = require('../controllers/bookController');
const DownloadController = require('../controllers/downloadController');
const { authenticate, authorize, authenticateStream } = require('../middleware/auth');

// Public — anyone can browse
router.get ('/',    BookController.getAll);
router.get ('/:id', BookController.getById);

// PDF streaming (token accepted via header OR ?token= query param)
// GET  /:id/stream   → inline preview (use in <iframe> or PDF viewer)
// GET  /:id/download → records download + streams as "Save As" attachment
router.get('/:id/stream',   authenticateStream, DownloadController.streamPdf);
router.get('/:id/download', authenticateStream, DownloadController.recordDownload);

// Admin stats for a book
router.get('/:id/downloads', authenticate, authorize('admin', 'librarian'), BookController.getDownloads);

// Librarian / Admin only — create / update / delete
// Files are pre-uploaded via POST /api/upload/single; coverUrl & pdfUrl passed as body fields
router.post  ('/',     authenticate, authorize('admin', 'librarian'), BookController.create);
router.put   ('/:id',  authenticate, authorize('admin', 'librarian'), BookController.update);
router.delete('/:id',  authenticate, authorize('admin'),              BookController.delete);

module.exports = router;
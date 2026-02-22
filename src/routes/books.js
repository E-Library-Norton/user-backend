// routes/books.js
const router         = require('express').Router();
const BookController = require('../controllers/bookController');
const DownloadController = require('../controllers/downloadController');
const { authenticate, authorize } = require('../middleware/auth');

// Public — anyone can browse
router.get ('/',           BookController.getAll);
router.get ('/:id',        BookController.getById);

// Download (must be logged in)
router.post('/:id/download', authenticate, DownloadController.recordDownload);
router.get ('/:id/downloads', authenticate, authorize('admin', 'librarian'), BookController.getDownloads);

// Librarian / Admin only
router.post('/',     authenticate, authorize('admin', 'librarian'), BookController.create);
router.put ('/:id',  authenticate, authorize('admin', 'librarian'), BookController.update);
router.delete('/:id',authenticate, authorize('admin'),              BookController.delete);

module.exports = router;
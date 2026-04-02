// routes/reviews.js
const router           = require('express').Router();
const ReviewController = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

// ── Nested under /books/:bookId ──────────────────────────────────────────────
// GET  /api/books/:bookId/reviews       — public
// POST /api/books/:bookId/reviews       — authenticated users only

// ── Stand-alone review routes ────────────────────────────────────────────────
// GET    /api/reviews/my               — authenticated user's own reviews
// PUT    /api/reviews/:id              — owner or admin
// DELETE /api/reviews/:id              — owner or admin

// Stand-alone
router.get('/my', authenticate, ReviewController.getMyReviews);
router.put('/:id', authenticate, ReviewController.update);
router.delete('/:id', authenticate, ReviewController.delete);

// ── Export nested handler for books router ────────────────────────────────────
// These are mounted inside books.js as /api/books/:bookId/reviews
ReviewController.getByBook = ReviewController.getByBook;

module.exports = router;
module.exports.ReviewController = ReviewController;

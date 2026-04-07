// routes/feedback.js
const router             = require('express').Router();
const FeedbackController = require('../controllers/feedbackController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// ── Public — submit feedback (optionalAuth: logged-in users auto-link) ──────
router.post('/', optionalAuth, FeedbackController.create);

// ── Admin — list all feedback with filters ──────────────────────────────────
router.get('/', authenticate, authorize('admin', 'librarian'), FeedbackController.getAll);

// ── Admin — feedback stats ──────────────────────────────────────────────────
router.get('/stats', authenticate, authorize('admin', 'librarian'), FeedbackController.getStats);

// ── Admin — single feedback detail ──────────────────────────────────────────
router.get('/:id', authenticate, authorize('admin', 'librarian'), FeedbackController.getById);

// ── Admin — update status / add notes ───────────────────────────────────────
router.patch('/:id', authenticate, authorize('admin', 'librarian'), FeedbackController.update);

// ── Admin — delete feedback ─────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), FeedbackController.delete);

module.exports = router;

// controllers/reviewController.js
const { Op, fn, col } = require('sequelize');
const { Review, User, Book } = require('../models');
const ResponseFormatter = require('../utils/responseFormatter');
const { NotFoundError, ConflictError, AuthorizationError } = require('../utils/errors');
const { logActivity } = require('../utils/activityLogger');
const { getIO, EVENTS } = require('../utils/socket');

// ── Helper: safely emit to admin room ─────────────────────────────────────────
function emitToAdmin(event, payload) {
  try { getIO().to('admin').emit(event, payload); } catch { /* ignore */ }
}
function emitPublic(event, payload) {
  try { getIO().emit(event, payload); } catch { /* ignore */ }
}

class ReviewController {
  // ── GET /api/books/:bookId/reviews ──────────────────────────────────────────
  static async getByBook(req, res, next) {
    try {
      const { bookId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const book = await Book.findOne({ where: { id: bookId, isDeleted: false } });
      if (!book) return ResponseFormatter.notFound(res, 'Book not found');

      const { count, rows } = await Review.findAndCountAll({
        where: { bookId, isDeleted: false },
        include: [
          {
            model: User,
            as: 'User',
            attributes: ['id', 'firstName', 'lastName', 'username', 'avatar'],
          },
        ],
        order: [['created_at', 'DESC']],
        limit: Number(limit),
        offset,
      });

      // Calculate average rating — single SQL aggregate instead of fetching all rows
      const avgResult = await Review.findOne({
        where: { bookId, isDeleted: false },
        attributes: [[fn('AVG', col('rating')), 'avgRating']],
        raw: true,
      });
      const avgRating = avgResult?.avgRating ? Number(Number(avgResult.avgRating).toFixed(1)) : null;

      return ResponseFormatter.success(res, {
        reviews: rows,
        averageRating: avgRating ? Number(avgRating.toFixed(1)) : null,
        totalReviews: count,
        totalPages: Math.ceil(count / Number(limit)),
        currentPage: Number(page),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── POST /api/books/:bookId/reviews ─────────────────────────────────────────
  static async create(req, res, next) {
    try {
      const { bookId } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.id;

      if (!rating || rating < 1 || rating > 5) {
        return ResponseFormatter.error(res, 'Rating must be between 1 and 5', 400);
      }

      const book = await Book.findOne({ where: { id: bookId, isDeleted: false } });
      if (!book) return ResponseFormatter.notFound(res, 'Book not found');

      // One review per user per book
      const existing = await Review.findOne({
        where: { bookId, userId, isDeleted: false },
      });
      if (existing) throw new ConflictError('You have already reviewed this book');

      const review = await Review.create({ bookId, userId, rating, comment });

      // Re-fetch with user info for response
      const full = await Review.findByPk(review.id, {
        include: [{ model: User, as: 'User', attributes: ['id', 'firstName', 'lastName', 'username', 'avatar'] }],
      });

      await logActivity({
        userId,
        action: 'created',
        targetType: 'review',
        targetId: review.id,
        targetName: book.title,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Real-time: notify admin + public
      const reviewPayload = {
        review: full,
        bookTitle: book.title,
        userName: full?.User ? `${full.User.firstName} ${full.User.lastName}` : 'A member',
      };
      emitToAdmin(EVENTS.REVIEW_CREATED, reviewPayload);
      emitPublic(EVENTS.REVIEW_CREATED, reviewPayload);

      return ResponseFormatter.success(res, full, 'Review submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ── PUT /api/reviews/:id ─────────────────────────────────────────────────────
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;
      const userId = req.user.id;

      if (rating && (rating < 1 || rating > 5)) {
        return ResponseFormatter.error(res, 'Rating must be between 1 and 5', 400);
      }

      const review = await Review.findOne({ where: { id, isDeleted: false } });
      if (!review) return ResponseFormatter.notFound(res, 'Review not found');

      // Only the author OR admin may edit
      const isAdmin = req.user.Roles?.some((r) => ['admin', 'librarian'].includes(r.name));
      if (review.userId !== userId && !isAdmin) {
        throw new AuthorizationError('You can only edit your own reviews');
      }

      if (rating !== undefined) review.rating = rating;
      if (comment !== undefined) review.comment = comment;
      await review.save();

      const full = await Review.findByPk(review.id, {
        include: [
          { model: User, as: 'User', attributes: ['id', 'firstName', 'lastName', 'username', 'avatar'] },
          { model: Book, as: 'Book', attributes: ['id', 'title'] },
        ],
      });

      // Real-time: notify admin
      emitToAdmin(EVENTS.REVIEW_UPDATED, {
        review: full,
        bookTitle: full?.Book?.title ?? 'Unknown',
        userName: full?.User ? `${full.User.firstName} ${full.User.lastName}` : 'A member',
      });

      return ResponseFormatter.success(res, full, 'Review updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ── DELETE /api/reviews/:id ──────────────────────────────────────────────────
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const review = await Review.findOne({ where: { id, isDeleted: false } });
      if (!review) return ResponseFormatter.notFound(res, 'Review not found');

      const isAdmin = req.user.Roles?.some((r) => ['admin', 'librarian'].includes(r.name));
      if (review.userId !== userId && !isAdmin) {
        throw new AuthorizationError('You can only delete your own reviews');
      }

      review.isDeleted = true;
      await review.save();

      await logActivity({
        userId,
        action: 'deleted',
        targetType: 'review',
        targetId: review.id,
        targetName: `Review #${review.id}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      // Real-time: notify admin
      emitToAdmin(EVENTS.REVIEW_DELETED, { reviewId: review.id, bookId: review.bookId });

      return ResponseFormatter.success(res, null, 'Review deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ── GET /api/reviews/my  (current user's own reviews) ───────────────────────
  static async getMyReviews(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const { count, rows } = await Review.findAndCountAll({
        where: { userId, isDeleted: false },
        include: [
          { model: Book, as: 'Book', attributes: ['id', 'title', 'titleKh', 'coverUrl'] },
        ],
        order: [['created_at', 'DESC']],
        limit: Number(limit),
        offset,
      });

      return ResponseFormatter.success(res, {
        reviews: rows,
        total: count,
        totalPages: Math.ceil(count / Number(limit)),
        currentPage: Number(page),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReviewController;

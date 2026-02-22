// ============================================
// FILE: src/controllers/statsController.js
// ============================================

const {
    Book,
    Video,
    User,
} = require("../models");
const { sequelize } = require("../config/database");
const ResponseFormatter = require("../utils/responseFormatter");

class StatsController {
    static async getOverview(req, res, next) {
        try {
            const [
                totalBook,
                totalUsers,
                downloadStats,
                viewStats,
            ] = await Promise.all([
                Book.count(),
                User.count(),
                Book.sum("downloads"),
                Book.sum("views"),
            ]);

            return ResponseFormatter.success(res, {
                totalBook,
                totalUsers,
                totalDownloads:
                    (downloadStats || 0) +
                    ((await Journal.sum("downloads")) || 0) +
                    ((await Publication.sum("downloads")) || 0),
                totalViews:
                    (viewStats || 0) +
                    ((await Journal.sum("views")) || 0) +
                    ((await Video.sum("views")) || 0),
            });
        } catch (error) {
            next(error);
        }
    }

    static async getPopular(req, res, next) {
        try {
            const { limit = 10 } = req.query;

            const [popularBooks] = await Promise.all([
                Book.findAll({
                    order: [["downloads", "DESC"]],
                    limit: parseInt(limit),
                    attributes: [
                        "id",
                        "title",
                        "isbn",
                        "downloads",
                        "views",
                        "coverUrl",
                    ],
                }),
            ]);

            return ResponseFormatter.success(res, {
                popularBooks,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getRecent(req, res, next) {
        try {
            const { limit = 10 } = req.query;

            const [recentBooks] = await Promise.all([
                Thesis.findAll({
                    order: [["createdAt", "DESC"]],
                    limit: parseInt(limit),
                    attributes: [
                        "id",
                        "title",
                        "isbn",
                        "year",
                        "coverUrl",
                        "createdAt",
                    ],
                }),
            ]);

            return ResponseFormatter.success(res, {
                recentBooks
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = StatsController;
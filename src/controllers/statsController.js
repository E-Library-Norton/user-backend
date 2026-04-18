// src/controllers/statsController.js
const {
    Book,
    User,
    Author,
    Category,
    Download,
    MaterialType,
    Role,
    Activity,
    sequelize
} = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const ResponseFormatter = require("../utils/responseFormatter");

// ── In-memory cache for overview stats (TTL = 60s) ────────────────────────────
let _overviewCache = null;
let _overviewCacheTime = 0;
const OVERVIEW_CACHE_TTL = 60_000; // 60 seconds

class StatsController {
    static async getOverview(req, res, next) {
        try {
            const { days = 7 } = req.query;
            const cacheKey = `overview_${days}`;

            // Return cached if fresh
            if (_overviewCache && _overviewCache._key === cacheKey &&
                Date.now() - _overviewCacheTime < OVERVIEW_CACHE_TTL) {
                return ResponseFormatter.success(res, _overviewCache);
            }

            // 1. Basic counts — run in parallel
            const [totalBooks, totalMembers, totalAuthors, totalCategories, totalDownloads] =
                await Promise.all([
                    Book.count({ where: { isDeleted: false } }).catch(() => 0),
                    User.count({ where: { isDeleted: false } }).catch(() => 0),
                    Author.count().catch(() => 0),
                    Category.count().catch(() => 0),
                    Download.count().catch(() => 0),
                ]);

            // ── Build activity where clause (needed by queries 5 & 6) ──
            let activityWhere = {};
            const dateLimit = new Date();
            const daysInt = parseInt(days);
            if (days !== 'all' && !isNaN(daysInt)) {
                if (daysInt === 1) {
                    dateLimit.setHours(0, 0, 0, 0);
                } else {
                    dateLimit.setDate(dateLimit.getDate() - daysInt);
                }
                activityWhere.createdAt = { [Op.gte]: dateLimit };
            }

            const currentYear = new Date().getFullYear();
            const startYear = currentYear - 4;

            // ── Run ALL independent queries in parallel ──────────────────────
            const [
                typeRows,
                yearRows,
                catViewRows,       // merged: category distribution + views in ONE query
                monthRows,
                totalCount,
                activities,
                roleRows,
            ] = await Promise.all([
                // 2. Material type counts
                Book.findAll({
                    where: { isDeleted: false },
                    include: [{ model: MaterialType, as: 'MaterialType', attributes: ['name'] }],
                    attributes: [
                        'typeId',
                        [fn('COUNT', col('Book.id')), 'count'],
                    ],
                    group: ['typeId', 'MaterialType.id', 'MaterialType.name'],
                    raw: true,
                    nest: true,
                }).catch(() => []),

                // 3. Upload stats by year
                Book.findAll({
                    where: {
                        isDeleted: false,
                        created_at: { [Op.gte]: new Date(`${startYear}-01-01`) },
                    },
                    attributes: [
                        [fn('EXTRACT', literal("YEAR FROM \"created_at\"")), 'year'],
                        [fn('COUNT', col('id')), 'count'],
                    ],
                    group: [fn('EXTRACT', literal("YEAR FROM \"created_at\""))],
                    raw: true,
                }).catch(() => []),

                // 4. Category distribution + views — SINGLE query (was 2 separate queries)
                Book.findAll({
                    where: { isDeleted: false },
                    include: [{ model: Category, as: 'Category', attributes: ['name'] }],
                    attributes: [
                        'categoryId',
                        [fn('COUNT', col('Book.id')), 'book_count'],
                        [fn('SUM', col('views')), 'total_views'],
                    ],
                    group: ['categoryId', 'Category.id', 'Category.name'],
                    order: [[fn('COUNT', col('Book.id')), 'DESC']],
                    subQuery: false,
                    raw: true,
                    nest: true,
                }).catch(() => []),

                // 4c. Monthly reading stats (last 12 months)
                Book.findAll({
                    where: {
                        isDeleted: false,
                        created_at: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 11)) },
                    },
                    attributes: [
                        [fn('TO_CHAR', col('created_at'), literal("'YYYY-MM'")), 'month'],
                        [fn('SUM', col('views')), 'total_views'],
                        [fn('SUM', col('downloads')), 'total_downloads'],
                        [fn('COUNT', col('id')), 'new_books'],
                    ],
                    group: [fn('TO_CHAR', col('created_at'), literal("'YYYY-MM'"))],
                    order: [[fn('TO_CHAR', col('created_at'), literal("'YYYY-MM'")), 'ASC']],
                    raw: true,
                }).catch(() => []),

                // 5a. Activity count
                Activity.count({ where: activityWhere }).catch(() => 0),

                // 5b. Recent activities
                Activity.findAll({
                    where: activityWhere,
                    include: [{
                        model: User,
                        as: 'User',
                        attributes: ['id', 'username', 'email', 'firstName', 'lastName'],
                        include: [{ model: Role, as: 'Roles', attributes: ['name'] }]
                    }],
                    order: [['createdAt', 'DESC']],
                    limit: 10,
                    subQuery: false,
                }).catch(() => []),

                // 6. Role activity stats
                Activity.findAll({
                    where: activityWhere,
                    attributes: [
                        'action',
                        [fn('COUNT', col('Activity.id')), 'count'],
                    ],
                    include: [{
                        model: User,
                        as: 'User',
                        attributes: [],
                        required: true,
                        include: [{
                            model: Role,
                            as: 'Roles',
                            attributes: ['name'],
                            required: true,
                            through: { attributes: [] },
                        }],
                    }],
                    group: ['User->Roles.name', 'Activity.action'],
                    raw: true,
                    nest: true,
                }).catch(() => []),
            ]);

            // ── Process results (pure JS, no DB) ────────────────────────────

            // 2. Material type counts
            const typeCounts = { theses: 0, journals: 0, articles: 0 };
            for (const row of typeRows) {
                const name = (row.MaterialType?.name || '').toLowerCase();
                const cnt = parseInt(row.count) || 0;
                if (name.includes('thesis') || name.includes('dissertation')) typeCounts.theses += cnt;
                else if (name.includes('journal')) typeCounts.journals += cnt;
                else if (name.includes('article')) typeCounts.articles += cnt;
            }

            // 3. Upload stats
            const yearMap = {};
            for (const r of yearRows) yearMap[r.year] = parseInt(r.count) || 0;
            const uploadStats = [];
            for (let i = 4; i >= 0; i--) {
                const year = currentYear - i;
                const books = yearMap[year] || 0;
                uploadStats.push({
                    year,
                    books,
                    theses: Math.floor(books * 0.2),
                    journals: Math.floor(books * 0.1),
                });
            }

            // 4. Category distribution + views (from single merged query)
            const top5ByCnt = [...catViewRows]
                .sort((a, b) => (parseInt(b.book_count) || 0) - (parseInt(a.book_count) || 0))
                .slice(0, 5);
            let categoryDistribution = top5ByCnt.map(r => ({
                name: r.Category?.name || 'Unknown',
                value: parseInt(r.book_count) || 0,
            }));
            if (categoryDistribution.length === 0) {
                categoryDistribution = [{ name: "General", value: totalBooks }];
            }

            const top5ByViews = [...catViewRows]
                .sort((a, b) => (parseInt(b.total_views) || 0) - (parseInt(a.total_views) || 0))
                .slice(0, 5);
            const categoryViews = top5ByViews.map(r => ({
                name: r.Category?.name || 'Unknown',
                views: parseInt(r.total_views) || 0,
                books: parseInt(r.book_count) || 0,
            }));

            // 4c. Monthly reading stats
            const monthlyReadingStats = monthRows.map(r => ({
                month: r.month,
                views: parseInt(r.total_views) || 0,
                downloads: parseInt(r.total_downloads) || 0,
                new_books: parseInt(r.new_books) || 0,
            }));

            // 5. Recent activities
            const recentActivities = activities.map(act => {
                const fullName = act.User
                    ? (`${act.User.firstName || ''} ${act.User.lastName || ''}`).trim() || act.User.username
                    : "System";
                return {
                    id: act.id,
                    action: act.action,
                    target_name: act.targetName,
                    created_at: act.createdAt,
                    type: act.targetType,
                    user: { eng_name: fullName, kh_name: fullName },
                    user_role: act.User?.Roles?.[0]?.name || "user",
                };
            });

            // 6. Role activity stats
            const roleMap = {};
            for (const row of roleRows) {
                const roleName = row.User?.Roles?.name || 'Unknown';
                if (!roleMap[roleName]) roleMap[roleName] = { create_count: 0, update_count: 0, delete_count: 0 };
                const cnt = parseInt(row.count) || 0;
                if (row.action === 'created') roleMap[roleName].create_count += cnt;
                else if (row.action === 'updated') roleMap[roleName].update_count += cnt;
                else if (row.action === 'deleted') roleMap[roleName].delete_count += cnt;
            }
            const roleActivityStats = Object.entries(roleMap)
                .filter(([, v]) => v.create_count > 0 || v.update_count > 0 || v.delete_count > 0)
                .map(([name, counts]) => ({
                    user_role: name.charAt(0).toUpperCase() + name.slice(1),
                    ...counts,
                }));

            const payload = {
                total_books: totalBooks,
                total_theses: typeCounts.theses,
                total_members: totalMembers,
                total_journals: typeCounts.journals,
                total_authors: totalAuthors,
                total_categories: totalCategories,
                total_articles: typeCounts.articles,
                upload_stats: uploadStats,
                category_stats: categoryDistribution,
                category_views: categoryViews,
                monthly_reading_stats: monthlyReadingStats,
                role_activity_stats: roleActivityStats,
                recent_activities: recentActivities,
                total_activities: totalCount || 0,
                _key: cacheKey, // internal cache key
            };

            // Cache the result
            _overviewCache = payload;
            _overviewCacheTime = Date.now();

            return ResponseFormatter.success(res, payload);
        } catch (error) {
            next(error);
        }
    }

    static async getPublicStats(req, res, next) {
        try {
            const [totalBooks, totalMembers, totalCategories] = await Promise.all([
                Book.count({ where: { isDeleted: false } }).catch(() => 0),
                User.count({ where: { isDeleted: false } }).catch(() => 0),
                Category.count().catch(() => 0),
            ]);
            return ResponseFormatter.success(res, {
                total_books: totalBooks,
                total_members: totalMembers,
                total_categories: totalCategories,
            });
        } catch (error) {
            next(error);
        }
    }

    static async getPopular(req, res, next) {
        try {
            const { limit = 10 } = req.query;
            const popularBooks = await Book.findAll({
                where: { isDeleted: false },
                include: [
                    { model: Category, as: 'Category', attributes: ['id', 'name'] },
                    { model: Author, as: 'Authors', attributes: ['id', 'name'], through: { attributes: [] } },
                ],
                attributes: {
                    include: [
                        [literal('(SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.book_id = "Book".id AND r.is_deleted = false)'), 'averageRating'],
                        [literal('(SELECT COUNT(*) FROM reviews r WHERE r.book_id = "Book".id AND r.is_deleted = false)'), 'reviewCount'],
                    ],
                },
                order: [["views", "DESC"]],
                limit: parseInt(limit),
                distinct: true,
                subQuery: false,
            });
            return ResponseFormatter.success(res, { popularBooks });
        } catch (error) {
            next(error);
        }
    }

    static async getRecent(req, res, next) {
        try {
            const { limit = 10 } = req.query;
            const recentBooks = await Book.findAll({
                where: { isDeleted: false },
                include: [
                    { model: Category, as: 'Category', attributes: ['id', 'name'] },
                    { model: Author, as: 'Authors', attributes: ['id', 'name'], through: { attributes: [] } },
                ],
                attributes: {
                    include: [
                        [literal('(SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r WHERE r.book_id = "Book".id AND r.is_deleted = false)'), 'averageRating'],
                        [literal('(SELECT COUNT(*) FROM reviews r WHERE r.book_id = "Book".id AND r.is_deleted = false)'), 'reviewCount'],
                    ],
                },
                order: [["created_at", "DESC"]],
                limit: parseInt(limit),
                distinct: true,
                subQuery: false,
            });
            return ResponseFormatter.success(res, { recentBooks });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = StatsController;
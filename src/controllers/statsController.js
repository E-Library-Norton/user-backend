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

            // 2. Material type counts — ONE grouped query instead of N+1 loop
            const typeCounts = { theses: 0, journals: 0, articles: 0 };
            try {
                const typeRows = await Book.findAll({
                    where: { isDeleted: false },
                    include: [{ model: MaterialType, as: 'MaterialType', attributes: ['name'] }],
                    attributes: [
                        'typeId',
                        [fn('COUNT', col('Book.id')), 'count'],
                    ],
                    group: ['typeId', 'MaterialType.id', 'MaterialType.name'],
                    raw: true,
                    nest: true,
                });
                for (const row of typeRows) {
                    const name = (row.MaterialType?.name || '').toLowerCase();
                    const cnt = parseInt(row.count) || 0;
                    if (name.includes('thesis') || name.includes('dissertation')) typeCounts.theses += cnt;
                    else if (name.includes('journal')) typeCounts.journals += cnt;
                    else if (name.includes('article')) typeCounts.articles += cnt;
                }
            } catch (typeErr) {
                console.error("Material type counts error:", typeErr.message);
            }

            // 3. Upload stats — ONE grouped query instead of 5 sequential
            let uploadStats = [];
            try {
                const currentYear = new Date().getFullYear();
                const startYear = currentYear - 4;
                const yearRows = await Book.findAll({
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
                });
                const yearMap = {};
                for (const r of yearRows) yearMap[r.year] = parseInt(r.count) || 0;
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
            } catch (uploadErr) {
                console.error("Upload stats error:", uploadErr.message);
            }

            // 4. Category distribution — ONE grouped query instead of N+1 loop
            let categoryDistribution = [];
            try {
                const catRows = await Book.findAll({
                    where: { isDeleted: false },
                    include: [{ model: Category, as: 'Category', attributes: ['name'] }],
                    attributes: [
                        'categoryId',
                        [fn('COUNT', col('Book.id')), 'count'],
                    ],
                    group: ['categoryId', 'Category.id', 'Category.name'],
                    order: [[fn('COUNT', col('Book.id')), 'DESC']],
                    limit: 5,
                    subQuery: false,
                    raw: true,
                    nest: true,
                });
                categoryDistribution = catRows.map(r => ({
                    name: r.Category?.name || 'Unknown',
                    value: parseInt(r.count) || 0,
                }));
            } catch (distErr) {
                console.error("Distribution error:", distErr.message);
            }
            if (categoryDistribution.length === 0) {
                categoryDistribution = [{ name: "General", value: totalBooks }];
            }

            // 5. Recent Activities (unchanged logic, already efficient)
            let recentActivities = [];
            let totalCount = 0;
            let activityWhere = {};
            const dateLimit = new Date();
            try {
                const daysInt = parseInt(days);
                if (days !== 'all' && !isNaN(daysInt)) {
                    if (daysInt === 1) {
                        dateLimit.setHours(0, 0, 0, 0);
                    } else {
                        dateLimit.setDate(dateLimit.getDate() - daysInt);
                    }
                    activityWhere.createdAt = { [Op.gte]: dateLimit };
                }

                totalCount = await Activity.count({ where: activityWhere });

                const activities = await Activity.findAll({
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
                });

                recentActivities = activities.map(act => {
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
            } catch (recentErr) {
                console.error("Recent activities error:", recentErr.message);
            }

            // 6. Role activity stats — ONE grouped query instead of N×3 loop
            let roleActivityStats = [];
            try {
                const roleRows = await Activity.findAll({
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
                });

                // Pivot: group by role name
                const roleMap = {};
                for (const row of roleRows) {
                    const roleName = row.User?.Roles?.name || 'Unknown';
                    if (!roleMap[roleName]) roleMap[roleName] = { create_count: 0, update_count: 0, delete_count: 0 };
                    const cnt = parseInt(row.count) || 0;
                    if (row.action === 'created') roleMap[roleName].create_count += cnt;
                    else if (row.action === 'updated') roleMap[roleName].update_count += cnt;
                    else if (row.action === 'deleted') roleMap[roleName].delete_count += cnt;
                }
                roleActivityStats = Object.entries(roleMap)
                    .filter(([, v]) => v.create_count > 0 || v.update_count > 0 || v.delete_count > 0)
                    .map(([name, counts]) => ({
                        user_role: name.charAt(0).toUpperCase() + name.slice(1),
                        ...counts,
                    }));
            } catch (roleErr) {
                console.error("Role activity stats error:", roleErr.message);
            }

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
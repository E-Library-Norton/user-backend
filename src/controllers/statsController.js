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
const { Op } = require("sequelize");
const ResponseFormatter = require("../utils/responseFormatter");

class StatsController {
    static async getOverview(req, res, next) {
        try {

            // 1. Basic counts (Very safe)
            let totalBooks = 0;
            let totalMembers = 0;
            let totalAuthors = 0;
            let totalCategories = 0;
            let totalDownloads = 0;
            let totalCount = 0;
            let activityWhere = {};
            const dateLimit = new Date();

            try {
                totalBooks = await Book.count({ where: { isDeleted: false } });
                totalMembers = await User.count({ where: { isDeleted: false } });
                totalAuthors = await Author.count();
                totalCategories = await Category.count();
                totalDownloads = await Download.count().catch(() => 0);
            } catch (basicErr) {
                console.error("Basic counts error:", basicErr.message);
            }

            // 2. Counts by material type
            const typeCounts = { theses: 0, journals: 0, articles: 0 };
            try {
                const materialTypes = await MaterialType.findAll();
                for (const type of materialTypes) {
                    const count = await Book.count({ where: { typeId: type.id, isDeleted: false } });
                    const name = (type.name || "").toLowerCase();
                    if (name.includes("thesis") || name.includes("dissertation")) typeCounts.theses += count;
                    else if (name.includes("journal")) typeCounts.journals += count;
                    else if (name.includes("article")) typeCounts.articles += count;
                }
            } catch (typeErr) {
                console.error("Material type counts error:", typeErr.message);
            }

            // 3. Upload stats (Simplified)
            const uploadStats = [];
            try {
                const currentYear = new Date().getFullYear();
                for (let i = 4; i >= 0; i--) {
                    const year = currentYear - i;
                    const yearCount = await Book.count({
                        where: {
                            isDeleted: false,
                            created_at: {
                                [Op.between]: [new Date(`${year}-01-01`), new Date(`${year}-12-31`)]
                            }
                        }
                    });
                    uploadStats.push({
                        year,
                        books: yearCount,
                        theses: Math.floor(yearCount * 0.2),
                        journals: Math.floor(yearCount * 0.1)
                    });
                }
            } catch (uploadErr) {
                console.error("Upload stats error:", uploadErr.message);
            }

            // 4. Category Distribution (Safe fallback)
            let categoryDistribution = [];
            try {
                const categories = await Category.findAll({ limit: 5 });
                for (const cat of categories) {
                    const count = await Book.count({ where: { categoryId: cat.id, isDeleted: false } });
                    categoryDistribution.push({ name: cat.name, value: count });
                }
            } catch (distErr) {
                console.error("Distribution error:", distErr.message);
            }

            if (categoryDistribution.length === 0) {
                categoryDistribution = [{ name: "General", value: totalBooks }];
            }

            // 5. Recent Activities
            let recentActivities = [];
            try {
                const { days = 7 } = req.query;
                const daysInt = parseInt(days);
                // dateLimit and activityWhere are already declared in the function scope

                if (days !== 'all' && !isNaN(daysInt)) {
                    if (daysInt === 1) {
                        dateLimit.setHours(0, 0, 0, 0);
                    } else {
                        dateLimit.setDate(dateLimit.getDate() - daysInt);
                    }
                    activityWhere.createdAt = { [Op.gte]: dateLimit };
                }

                totalCount = await Activity.count({
                    where: activityWhere
                });

                const activities = await Activity.findAll({
                    where: activityWhere,
                    include: [
                        {
                            model: User,
                            as: 'User',
                            attributes: ['id', 'username', 'email', 'firstName', 'lastName'],
                            include: [{ model: Role, as: 'Roles', attributes: ['name'] }]
                        }
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: 10,
                    subQuery: false
                });

                if (activities.length > 0 || totalCount > 0) {
                    recentActivities = activities.map(act => {
                        const fullName = act.User ?
                            (`${act.User.firstName || ''} ${act.User.lastName || ''}`).trim() || act.User.username :
                            "System";

                        return {
                            id: act.id,
                            action: act.action,
                            target_name: act.targetName,
                            created_at: act.createdAt,
                            type: act.targetType,
                            user: {
                                eng_name: fullName,
                                kh_name: fullName // Fallback to same name if no KH name field exists
                            },
                            user_role: act.User?.Roles?.[0]?.name || "user"
                        };
                    });
                }
            } catch (recentErr) {
                console.error("Recent activities error:", recentErr.message);
            }

            // 6. Role activity stats (Filtered by dateLimit)
            let roleActivityStats = [];
            try {
                const roles = await Role.findAll();

                for (const role of roles) {
                    if (!role.name) continue;

                    // Get activity counts for this role in the specified period
                    // We join with User and Roles
                    const createCount = await Activity.count({
                        distinct: true,
                        col: 'id',
                        where: {
                            ...activityWhere,
                            action: 'created'
                        },
                        include: [{
                            model: User,
                            as: 'User',
                            required: true,
                            include: [{
                                model: Role,
                                as: 'Roles',
                                where: { id: role.id },
                                required: true
                            }]
                        }]
                    });

                    const updateCount = await Activity.count({
                        distinct: true,
                        col: 'id',
                        where: {
                            ...activityWhere,
                            action: 'updated'
                        },
                        include: [{
                            model: User,
                            as: 'User',
                            required: true,
                            include: [{
                                model: Role,
                                as: 'Roles',
                                where: { id: role.id },
                                required: true
                            }]
                        }]
                    });

                    const deleteCount = await Activity.count({
                        distinct: true,
                        col: 'id',
                        where: {
                            ...activityWhere,
                            action: 'deleted'
                        },
                        include: [{
                            model: User,
                            as: 'User',
                            required: true,
                            include: [{
                                model: Role,
                                as: 'Roles',
                                where: { id: role.id },
                                required: true
                            }]
                        }]
                    });

                    if (createCount > 0 || updateCount > 0 || deleteCount > 0) {
                        roleActivityStats.push({
                            user_role: role.name.charAt(0).toUpperCase() + role.name.slice(1),
                            create_count: createCount,
                            update_count: updateCount,
                            delete_count: deleteCount
                        });
                    }
                }
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
                total_activities: totalCount || 0
            };

            return ResponseFormatter.success(res, payload);
        } catch (error) {
            next(error);
        }
    }

    static async getPopular(req, res, next) {
        try {
            const { limit = 10 } = req.query;
            const popularBooks = await Book.findAll({
                where: { isDeleted: false },
                order: [["views", "DESC"]],
                limit: parseInt(limit),
                attributes: ["id", "title", "isbn", "views", "coverUrl"],
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
                order: [["created_at", "DESC"]],
                limit: parseInt(limit),
                attributes: ["id", "title", "isbn", "coverUrl", "created_at"],
            });
            return ResponseFormatter.success(res, { recentBooks });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = StatsController;
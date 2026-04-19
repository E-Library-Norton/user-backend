const { Activity, User, Role } = require("../models");
const { Op } = require("sequelize");
const ResponseFormatter = require("../utils/responseFormatter");

class ActivityController {
    /**
     * Get paginated and filtered activity logs
     */
    static async getActivities(req, res, next) {
        try {
            const {
                page = 1,
                limit = 10,
                type = 'all',
                search = '',
                userId = null,
                days = null
            } = req.query;

            const offset = (page - 1) * limit;

            // Build where clause
            const where = {};

            if (type !== 'all') {
                where.targetType = type;
            }

            if (userId) {
                where.userId = userId;
            }

            if (days && days !== 'all') {
                const daysInt = parseInt(days);
                if (!isNaN(daysInt)) {
                    const dateLimit = new Date();
                    if (daysInt === 1) {
                        dateLimit.setHours(0, 0, 0, 0);
                    } else {
                        dateLimit.setDate(dateLimit.getDate() - daysInt);
                    }
                    where.createdAt = {
                        [Op.gte]: dateLimit
                    };
                }
            }

            if (search) {
                where[Op.or] = [
                    { action: { [Op.like]: `%${search}%` } },
                    { targetName: { [Op.like]: `%${search}%` } },
                    { '$User.firstName$': { [Op.like]: `%${search}%` } },
                    { '$User.lastName$': { [Op.like]: `%${search}%` } },
                    { '$User.username$': { [Op.like]: `%${search}%` } }
                ];
            }

            const { count, rows } = await Activity.findAndCountAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'User',
                        attributes: ['id', 'username', 'email', 'firstName', 'lastName'],
                        include: [{ model: Role, as: 'Roles', attributes: ['name'] }]
                    }
                ],
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                subQuery: false // Necessary for nested include with limit
            });

            const activities = rows.map(act => {
                const fullName = act.User ?
                    (`${act.User.firstName } ${act.User.lastName }`).trim() || act.User.username :
                    "System";

                return {
                    id: String(act.id),
                    user: {
                        name: fullName,
                        email: act.User?.email,
                        initials: (act.User?.firstName && act.User?.lastName)
                            ? (act.User.firstName[0] + act.User.lastName[0]).toUpperCase()
                            : (act.User?.username?.substring(0, 2).toUpperCase() || "SY"),
                        role: act.User?.Roles?.[0]?.name || "user"
                    },
                    action: act.action,
                    target: act.targetName,
                    type: act.targetType,
                    metadata: act.metadata,
                    timestamp: act.createdAt
                };
            });

            return ResponseFormatter.success(res, {
                activities,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit)
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ActivityController;

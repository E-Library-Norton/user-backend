const { Activity, User, Role } = require('../models');
const { getIO } = require('../socket');

/**
 * Utility to log user activities for the recent activity feed
 * 
 * @param {Object} options
 * @param {number} options.userId - ID of the user performing the action
 * @param {string} options.action - Type of action (e.g., 'uploaded', 'updated', 'deleted', 'login')
 * @param {number} [options.targetId] - ID of the target object
 * @param {string} [options.targetName] - Name/Title of the target object
 * @param {string} options.targetType - Type of target ('book', 'user', 'category', etc.)
 * @param {Object} [options.metadata] - Additional JSON metadata
 */
async function logActivity({ userId, action, targetId, targetName, targetType, metadata }) {
    try {
        const activity = await Activity.create({
            userId,
            action,
            targetId,
            targetName,
            targetType,
            metadata
        });

        // Emit real-time activity if possible
        try {
            const io = getIO();
            const user = await User.findByPk(userId, {
                attributes: ['id', 'username', 'firstName', 'lastName'],
                include: [{ model: Role, as: 'Roles', attributes: ['name'] }]
            });

            if (user) {
                const fullName = (`${user.firstName || ''} ${user.lastName || ''}`).trim() || user.username;
                const formattedActivity = {
                    id: String(activity.id),
                    user: {
                        name: fullName,
                        initials: (user.firstName && user.lastName)
                            ? (user.firstName[0] + user.lastName[0]).toUpperCase()
                            : user.username.substring(0, 2).toUpperCase(),
                        role: user.Roles?.[0]?.name || "user"
                    },
                    action: activity.action,
                    target: activity.targetName,
                    timestamp: "Just now", // Frontend will handle formatting or use a placeholder
                    type: activity.targetType,
                    created_at: activity.createdAt
                };

                io.emit("new_activity", formattedActivity);
            }
        } catch (socketErr) {
            console.warn('⚠️ Could not emit real-time activity:', socketErr.message);
        }

    } catch (err) {
        // Silence error to prevent breaking main logic, but log it
        console.error('❌ Activity Logger Error:', err.message);
    }
}

module.exports = { logActivity };

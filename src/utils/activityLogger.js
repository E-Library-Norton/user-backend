const { Activity } = require('../models');

/**
 * Logs a user activity to the database.
 *
 * @param {number} options.userId      - ID of the user performing the action
 * @param {string} options.action      - Action type ('created', 'updated', 'deleted', 'login')
 * @param {number} [options.targetId]  - ID of the target object
 * @param {string} [options.targetName]- Name/title of the target object
 * @param {string} options.targetType  - Target type ('book', 'user', 'role', etc.)
 * @param {Object} [options.metadata]  - Additional JSON metadata
 */
async function logActivity({ userId, action, targetId, targetName, targetType, metadata }) {
    try {
        await Activity.create({ userId, action, targetId, targetName, targetType, metadata });
    } catch (err) {
        console.error('Activity Logger Error:', err.message);
    }
}

module.exports = { logActivity };

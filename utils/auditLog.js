const { run } = require('../config/database');

async function writeLog(userId, username, actionType, description) {
    try {
        await run(
            `INSERT INTO activity_logs (user_id, username, action_type, description)
             VALUES (?, ?, ?, ?)`,
            [userId || null, username || 'unknown', actionType || 'unknown_action', description || '']
        );
    } catch (error) {
        // Never throw from audit logging; this must not impact app flows.
    }
}

module.exports = {
    writeLog
};

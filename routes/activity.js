// User activity feed routes + shared logging helper

const express = require('express');
const router = express.Router();

const { get, query, run } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

function safeJsonParse(value) {
    if (value === null || value === undefined || value === '') return {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

async function logActivity(userId, type, message, meta = {}) {
    if (!userId || !type || !message) return;

    const metaText = meta && typeof meta === 'object' ? JSON.stringify(meta) : JSON.stringify({ value: meta });

    // Insert new record
    await run(
        `INSERT INTO activity_feed (user_id, type, message, meta, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, type, message, metaText]
    );

    // Prune records older than the newest 100 for this user
    await run(
        `DELETE FROM activity_feed
         WHERE user_id = ?
           AND id NOT IN (
             SELECT id FROM activity_feed
             WHERE user_id = ?
             ORDER BY id DESC
             LIMIT 100
           )`,
        [userId, userId]
    );
}

router.get('/api/feed', requireAuth, async (req, res) => {
    try {
        const enabledFeed = true; // table-driven feature flags could be added later

        if (!enabledFeed) {
            return res.json({ enabled: false, feed: [] });
        }

        const limitRaw = req.query?.limit;
        const limit = Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 20));

        const rows = await query(
            `SELECT id, type, message, meta, created_at
             FROM activity_feed
             WHERE user_id = ?
             ORDER BY id DESC
             LIMIT ?`,
            [req.session.user.id, limit]
        );

        const feed = (rows || []).map(r => ({
            id: r.id,
            type: r.type,
            message: r.message,
            meta: safeJsonParse(r.meta),
            created_at: r.created_at
        }));

        res.json({ feed });
    } catch (error) {
        console.error('Activity feed error:', error);
        res.status(500).json({ success: false, message: 'Error fetching activity feed' });
    }
});

module.exports = router;
module.exports.logActivity = logActivity;


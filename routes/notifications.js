// Notifications center routes + helpers

const express = require('express');
const router = express.Router();

const { get, query, run, transaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

function normalizeType(type) {
    const t = String(type || 'info').toLowerCase();
    return ['info', 'success', 'warning', 'error'].includes(t) ? t : 'info';
}

async function createNotification(userId, type, title, message) {
    const notifType = normalizeType(type);
    if (!userId) return null;

    const result = await run(
        `INSERT INTO notifications (user_id, type, title, message, is_read, is_global, created_at)
         VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)`,
        [userId, notifType, title || '', message || '']
    );
    return result?.lastID || null;
}

async function broadcastNotification(app, type, title, message) {
    const notifType = normalizeType(type);

    const result = await run(
        `INSERT INTO notifications (user_id, type, title, message, is_read, is_global, created_at)
         VALUES (NULL, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP)`,
        [notifType, title || '', message || '']
    );

    try {
        const io = app?.get && app.get('io');
        if (io && typeof io.emit === 'function') {
            io.emit('notification', { type: notifType, title: title || '', message: message || '' });
        }
    } catch (e) {
        // best-effort emit only
    }

    return result?.lastID || null;
}

router.get('/api/list', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        const rows = await query(
            `SELECT
                n.id,
                n.user_id,
                n.type,
                n.title,
                n.message,
                n.is_read,
                n.is_global,
                n.created_at,
                CASE
                    WHEN n.is_global = 1 THEN CASE WHEN nr.notification_id IS NULL THEN 0 ELSE 1 END
                    ELSE n.is_read
                END as read_for_user
             FROM notifications n
             LEFT JOIN notification_reads nr
               ON nr.notification_id = n.id AND nr.user_id = ?
             WHERE (n.user_id = ? OR n.is_global = 1)
             ORDER BY n.id DESC
             LIMIT 30`,
            [userId, userId]
        );

        const unreadCountRow = await get(
            `SELECT COUNT(*) as count
             FROM (
                SELECT n.id
                FROM notifications n
                LEFT JOIN notification_reads nr
                  ON nr.notification_id = n.id AND nr.user_id = ?
                WHERE (n.user_id = ? OR n.is_global = 1)
                  AND (
                    (n.is_global = 1 AND nr.notification_id IS NULL)
                    OR
                    (n.is_global = 0 AND COALESCE(n.is_read, 0) = 0)
                  )
             )`,
            [userId, userId]
        );

        const notifications = (rows || []).map(r => ({
            id: r.id,
            type: r.type,
            title: r.title,
            message: r.message,
            is_global: Number(r.is_global) === 1,
            is_read: Number(r.read_for_user) === 1,
            created_at: r.created_at
        }));

        res.json({
            notifications,
            unread_count: unreadCountRow?.count || 0
        });
    } catch (error) {
        console.error('Notifications list error:', error);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
});

router.post('/api/read-all', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        await transaction(async () => {
            // Mark all user-specific as read
            await run(
                `UPDATE notifications SET is_read = 1
                 WHERE user_id = ?`,
                [userId]
            );

            // Mark all global as read for this user
            await run(
                `INSERT OR IGNORE INTO notification_reads (user_id, notification_id)
                 SELECT ?, n.id
                 FROM notifications n
                 WHERE n.is_global = 1`,
                [userId]
            );
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Notifications read-all error:', error);
        res.status(500).json({ success: false, message: 'Error marking notifications as read' });
    }
});

router.post('/api/read/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid notification ID' });

        const notif = await get(
            `SELECT id, user_id, is_global FROM notifications WHERE id = ?`,
            [id]
        );

        if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

        // If user-specific, only owner can mark read.
        if (!Number(notif.is_global) && Number(notif.user_id) !== Number(userId)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (Number(notif.is_global) === 1) {
            await run(
                `INSERT OR IGNORE INTO notification_reads (user_id, notification_id)
                 VALUES (?, ?)`,
                [userId, id]
            );
        } else {
            await run(
                `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
                [id, userId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Notifications read-one error:', error);
        res.status(500).json({ success: false, message: 'Error marking notification as read' });
    }
});

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.broadcastNotification = broadcastNotification;


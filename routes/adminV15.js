// Admin API v15 for daily rewards + referral system

const express = require('express');
const router = express.Router();

const { get, query, run } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

router.get('/daily-rewards', requireAdmin, async (req, res) => {
    try {
        const rewards = await query(
            `SELECT day_number, coins FROM daily_reward_config ORDER BY day_number ASC`
        );

        const flag = await get(
            `SELECT enabled FROM feature_flags WHERE name = ?`,
            ['daily_rewards']
        );

        res.json({
            rewards,
            enabled: flag ? Number(flag.enabled) === 1 : false
        });
    } catch (error) {
        console.error('Error fetching daily rewards (admin v15):', error);
        res.status(500).json({ success: false, message: 'Error fetching daily rewards' });
    }
});

router.post('/daily-rewards', requireAdmin, async (req, res) => {
    try {
        const { rewards, enabled } = req.body || {};

        const enabledInt = enabled ? 1 : 0;

        // Update feature flag
        await run(
            `INSERT OR REPLACE INTO feature_flags (name, enabled) VALUES (?, ?)`,
            ['daily_rewards', enabledInt]
        );

        // Optionally upsert reward rows by day_number
        if (Array.isArray(rewards)) {
            for (const row of rewards) {
                const dayNumber = parseInt(row?.day_number);
                const coins = Math.max(0, parseInt(row?.coins));

                if (!dayNumber || dayNumber < 1 || dayNumber > 7) continue;

                await run(
                    `INSERT OR REPLACE INTO daily_reward_config (day_number, coins) VALUES (?, ?)`,
                    [dayNumber, coins]
                );
            }
        }

        res.json({ success: true, message: 'Daily rewards updated successfully' });
    } catch (error) {
        console.error('Error saving daily rewards (admin v15):', error);
        res.status(500).json({ success: false, message: 'Error saving daily rewards' });
    }
});



// Maintenance windows
router.get('/maintenance', requireAdmin, async (req, res) => {
    try {
        const rows = await query(
            `SELECT id, title, message, starts_at, ends_at, is_active, created_at
             FROM maintenance_schedule
             ORDER BY created_at DESC
             LIMIT 10`
        );

        return res.json({ success: true, windows: rows || [] });
    } catch (error) {
        console.error('Error fetching maintenance windows (admin v15):', error);
        return res.status(500).json({ success: false, message: 'Error fetching maintenance windows' });
    }
});

router.post('/maintenance', requireAdmin, async (req, res) => {
    try {
        const { title, message, starts_at, ends_at } = req.body || {};

        if (!message || String(message).trim() === '') {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const startMs = new Date(starts_at).getTime();
        const endMs = new Date(ends_at).getTime();

        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
            return res.status(400).json({ success: false, message: 'Valid start and end datetime are required' });
        }

        if (endMs <= startMs) {
            return res.status(400).json({ success: false, message: 'ends_at must be after starts_at' });
        }

        const titleValue = title && String(title).trim() ? String(title).trim() : 'Scheduled Maintenance';

        await run(
            `INSERT INTO maintenance_schedule (title, message, starts_at, ends_at, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [titleValue, String(message).trim(), new Date(startMs).toISOString(), new Date(endMs).toISOString()]
        );

        return res.json({ success: true, message: 'Maintenance window scheduled' });
    } catch (error) {
        console.error('Error scheduling maintenance window (admin v15):', error);
        return res.status(500).json({ success: false, message: 'Error scheduling maintenance window' });
    }
});

router.delete('/maintenance/:id', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!id) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        await run(
            `UPDATE maintenance_schedule
             SET is_active = 0
             WHERE id = ?`,
            [id]
        );

        return res.json({ success: true, message: 'Maintenance window cancelled' });
    } catch (error) {
        console.error('Error cancelling maintenance window (admin v15):', error);
        return res.status(500).json({ success: false, message: 'Error cancelling maintenance window' });
    }
});

// Broadcast messages (global)
router.post('/broadcast', requireAdmin, async (req, res) => {
    try {
        const { title, message, type, segment } = req.body || {};

        if (!message || String(message).trim() === '') {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        const normalizedTitle = title && String(title).trim() ? String(title).trim() : 'Admin Broadcast';
        const normalizedMessage = String(message).trim();

        const allowedTypes = new Set(['info', 'success', 'warning', 'error']);
        let normalizedType = String(type || 'info').toLowerCase();
        if (normalizedType === 'alert') normalizedType = 'error';
        if (!allowedTypes.has(normalizedType)) normalizedType = 'info';

        const normalizedSegment = segment && String(segment).trim() ? String(segment).trim() : 'all';

        // 1) Save broadcast row (audit/history)
        await run(
            `INSERT INTO broadcast_messages (title, message, segment)
             VALUES (?, ?, ?)`,
            [normalizedTitle, normalizedMessage, normalizedSegment]
        );

        // 2) Save as a global notification for bell UI
        await run(
            `INSERT INTO notifications (user_id, type, title, message, is_read, is_global)
             VALUES (?, ?, ?, ?, 0, 1)`,
            [null, normalizedType, normalizedTitle, normalizedMessage]
        );

        // 3) Emit live to all clients
        try {
            const io = req.app.get('io');
            if (io) io.emit('notification', { type: normalizedType, title: normalizedTitle, message: normalizedMessage });
        } catch (e) {
            // best-effort: don't fail the request
        }

        return res.json({ success: true, message: 'Broadcast sent successfully' });
    } catch (error) {
        console.error('Error sending broadcast (admin v15):', error);
        return res.status(500).json({ success: false, message: 'Error sending broadcast' });
    }
});

router.get('/broadcast/history', requireAdmin, async (req, res) => {
    try {
        const broadcasts = await query(
            `SELECT id, title, message, segment, created_at
             FROM broadcast_messages
             ORDER BY created_at DESC
             LIMIT 20`
        );

        return res.json({ success: true, broadcasts: broadcasts || [] });
    } catch (error) {
        console.error('Error fetching broadcast history (admin v15):', error);
        return res.status(500).json({ success: false, message: 'Error fetching broadcast history' });
    }
});

module.exports = router;


const express = require('express');
const path = require('path');
const router = express.Router();

const { db, get, query, run } = require('../config/database');
const { sendBrandedView } = require('../config/brandingHelper');

const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/auth/login');
    if (!req.session.user.is_admin) return res.status(403).send('Access denied. Admin only.');
    next();
};

router.get('/', requireAuth, requireAdmin, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/admin-logs.html'));
});

router.get('/api/list', requireAuth, requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const offset = (page - 1) * limit;

        const where = [];
        const params = [];

        if (req.query.type) {
            where.push('action_type = ?');
            params.push(String(req.query.type));
        }
        if (req.query.search) {
            where.push('(username LIKE ? OR description LIKE ?)');
            const term = `%${String(req.query.search)}%`;
            params.push(term, term);
        }
        if (req.query.date_from) {
            where.push('created_at >= datetime(?)');
            params.push(String(req.query.date_from));
        }
        if (req.query.date_to) {
            where.push('created_at <= datetime(?, \'+1 day\')');
            params.push(String(req.query.date_to));
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const totalRow = await get(`SELECT COUNT(*) as total FROM activity_logs ${whereSql}`, params);
        const total = Number(totalRow?.total || 0);
        const pages = Math.max(1, Math.ceil(total / limit));

        const logs = await query(
            `SELECT id, user_id, username, action_type, description, created_at
             FROM activity_logs
             ${whereSql}
             ORDER BY datetime(created_at) DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            success: true,
            logs: logs || [],
            pagination: { page, limit, total, pages }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load audit logs' });
    }
});

router.get('/api/action-types', requireAuth, requireAdmin, async (req, res) => {
    try {
        const rows = await query(
            `SELECT DISTINCT action_type
             FROM activity_logs
             WHERE action_type IS NOT NULL AND action_type != ''
             ORDER BY action_type ASC`
        );
        res.json({ success: true, types: (rows || []).map(r => r.action_type) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load action types' });
    }
});

router.get('/api/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const row = await get(
            `SELECT log_retention_days
             FROM feature_flags
             WHERE name = 'audit_logs'
             ORDER BY id DESC
             LIMIT 1`
        );
        res.json({ success: true, log_retention_days: Number(row?.log_retention_days || 90) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load log settings' });
    }
});

router.post('/api/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        const days = Math.max(0, parseInt(req.body?.log_retention_days || '0', 10));
        const existing = await get(`SELECT id FROM feature_flags WHERE name = 'audit_logs' ORDER BY id DESC LIMIT 1`);

        if (existing?.id) {
            await run(
                `UPDATE feature_flags
                 SET log_retention_days = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [days, existing.id]
            );
        } else {
            await run(
                `INSERT INTO feature_flags (name, enabled, log_retention_days)
                 VALUES ('audit_logs', 1, ?)`,
                [days]
            );
        }

        res.json({ success: true, message: 'Log settings saved' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save log settings' });
    }
});

router.delete('/api/clear', requireAuth, requireAdmin, async (req, res) => {
    try {
        await run('DELETE FROM activity_logs');
        res.json({ success: true, message: 'All logs cleared' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to clear logs' });
    }
});

module.exports = router;

// Public maintenance status handler (no auth required)

const { get } = require('../config/database');

async function maintenanceStatusHandler(req, res) {
    try {
        const nowIso = new Date().toISOString();

        // Prefer an active window if any exist.
        const active = await get(
            `SELECT title, message, starts_at, ends_at
             FROM maintenance_schedule
             WHERE is_active = 1
               AND starts_at IS NOT NULL AND ends_at IS NOT NULL
               AND starts_at <= ?
               AND ends_at >= ?
             ORDER BY starts_at DESC
             LIMIT 1`,
            [nowIso, nowIso]
        );

        if (active) {
            return res.json({
                active: true,
                upcoming: false,
                title: active.title || 'Scheduled Maintenance',
                message: active.message || '',
                starts_at: active.starts_at,
                ends_at: active.ends_at
            });
        }

        const upcoming = await get(
            `SELECT title, message, starts_at, ends_at
             FROM maintenance_schedule
             WHERE is_active = 1
               AND starts_at IS NOT NULL AND ends_at IS NOT NULL
               AND starts_at > ?
               AND ends_at >= ?
             ORDER BY starts_at ASC
             LIMIT 1`,
            [nowIso, nowIso]
        );

        if (upcoming) {
            return res.json({
                active: false,
                upcoming: true,
                title: upcoming.title || 'Scheduled Maintenance',
                message: upcoming.message || '',
                starts_at: upcoming.starts_at,
                ends_at: upcoming.ends_at
            });
        }

        return res.json({
            active: false,
            upcoming: false,
            title: null,
            message: null,
            starts_at: null,
            ends_at: null
        });
    } catch (e) {
        console.error('[maintenance] status error:', e);
        return res.json({
            active: false,
            upcoming: false,
            title: null,
            message: null,
            starts_at: null,
            ends_at: null
        });
    }
}

module.exports = { maintenanceStatusHandler };


// Server health timeline poller (records Pterodactyl current_state snapshots)

const { query, run } = require('./database');
const pterodactyl = require('./pterodactyl');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PRUNE_ROWS_PER_SERVER = 288; // 288 * 5 minutes = 24 hours

let intervalId = null;

function mapCurrentStateToTimelineStatus(currentState) {
    const state = String(currentState || 'unknown').toLowerCase();
    if (state === 'running') return 'online';
    if (state === 'offline' || state === 'unknown') return 'offline';
    return state; // keep others as-is (starting/stopping/etc)
}

async function pollOnce() {
    try {
        const servers = await query(
            `SELECT s.id as server_id, s.pterodactyl_identifier, u.pterodactyl_user_id
             FROM servers s
             INNER JOIN users u ON u.id = s.user_id
             WHERE s.pterodactyl_identifier IS NOT NULL
               AND s.pterodactyl_identifier != ''
               AND u.pterodactyl_user_id IS NOT NULL
               AND u.pterodactyl_user_id != ''`
        );

        if (!servers || servers.length === 0) return;

        for (const s of servers) {
            const serverId = s.server_id;
            const serverIdentifier = s.pterodactyl_identifier;
            const pterodactylUserId = s.pterodactyl_user_id;

            try {
                const result = await pterodactyl.getServerResources(serverIdentifier, pterodactylUserId);
                if (!result?.success || !result.data) continue;

                const currentState =
                    result.data?.attributes?.current_state ||
                    result.data?.current_state ||
                    'unknown';

                const status = mapCurrentStateToTimelineStatus(currentState);

                await run(
                    `INSERT INTO server_health_logs (server_id, status) VALUES (?, ?)`,
                    [serverId, status]
                );

                // Prune to last N rows per server.
                await run(
                    `DELETE FROM server_health_logs
                     WHERE server_id = ?
                       AND id NOT IN (
                         SELECT id
                         FROM server_health_logs
                         WHERE server_id = ?
                         ORDER BY recorded_at DESC
                         LIMIT ?
                       )`,
                    [serverId, serverId, PRUNE_ROWS_PER_SERVER]
                );
            } catch (e) {
                // Best-effort: continue polling other servers.
            }
        }
    } catch (e) {
        // Best-effort: polling should never crash the server.
    }
}

function start() {
    if (intervalId) return;

    // Kick off immediately so fresh installs start filling the timeline quickly.
    pollOnce().catch(() => {});

    intervalId = setInterval(() => {
        pollOnce().catch(() => {});
    }, POLL_INTERVAL_MS);
}

function stop() {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
}

async function getServerHealthTimeline(serverId, slots = 24) {
    const limit = Math.max(1, parseInt(slots, 10) || 24);
    const rows = await query(
        `SELECT status, recorded_at
         FROM server_health_logs
         WHERE server_id = ?
         ORDER BY recorded_at DESC
         LIMIT ?`,
        [serverId, limit]
    );

    // Reverse to chronological order.
    const chronological = (rows || []).reverse();
    return chronological.map(r => ({
        status: r.status,
        recorded_at: r.recorded_at
    }));
}

module.exports = {
    start,
    stop,
    getServerHealthTimeline
};


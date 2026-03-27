const { get, query, run } = require('./database');
const pterodactyl = require('./pterodactyl');

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
let intervalId = null;

function addFrequency(dateInput, frequency) {
    const base = new Date(dateInput);
    if (Number.isNaN(base.getTime())) return null;
    switch (String(frequency || 'monthly')) {
        case 'hourly':
            base.setHours(base.getHours() + 1);
            break;
        case 'daily':
            base.setDate(base.getDate() + 1);
            break;
        case 'weekly':
            base.setDate(base.getDate() + 7);
            break;
        case 'monthly':
        default:
            base.setMonth(base.getMonth() + 1);
            break;
    }
    return base.toISOString();
}

async function getRenewalSettings() {
    const settings = await get('SELECT * FROM renewal_settings ORDER BY id DESC LIMIT 1');
    return {
        renewal_enabled: Number(settings?.renewal_enabled || 0),
        renewal_frequency: settings?.renewal_frequency || 'monthly',
        renewal_coins_per_cycle: Math.max(0, Number(settings?.renewal_coins_per_cycle || 0)),
        renewal_deduction_mode: settings?.renewal_deduction_mode || 'manual',
        renewal_grace_cycles: Math.max(0, Number(settings?.renewal_grace_cycles || 0))
    };
}

async function writeRenewalEvent({ serverId, userId, dueAt, amount, mode, result, notes }) {
    try {
        await run(
            `INSERT INTO server_renewal_events
             (server_id, user_id, due_at, processed_at, amount, mode, result, notes)
             VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)`,
            [serverId, userId, dueAt || null, amount || 0, mode || null, result || null, notes || null]
        );
    } catch (_) {
        // Best effort: event logging must not break renewal processing.
    }
}

async function maybeSetServerSuspension(server, shouldSuspend) {
    try {
        const appServerId = parseInt(String(server?.pterodactyl_id || ''), 10);
        if (Number.isNaN(appServerId) || appServerId <= 0) return;
        if (!await pterodactyl.isConfigured()) return;
        if (shouldSuspend) {
            await pterodactyl.suspendServer(appServerId);
        } else {
            await pterodactyl.unsuspendServer(appServerId);
        }
    } catch (_) {
        // Best effort: local state still updates, admin can re-run actions.
    }
}

async function processDueRenewalsOnce() {
    const settings = await getRenewalSettings();
    if (!settings.renewal_enabled || settings.renewal_coins_per_cycle <= 0) {
        return;
    }

    const nowIso = new Date().toISOString();
    const maxAllowedDueIso = addFrequency(nowIso, settings.renewal_frequency);
    const maxAllowedDueDate = maxAllowedDueIso ? new Date(maxAllowedDueIso) : null;
    const dueRows = await query(
        `SELECT s.id, s.user_id, s.pterodactyl_id, s.name,
                s.renewal_next_due_at, s.renewal_last_processed_at,
                s.renewal_status, COALESCE(s.renewal_overdue_count, 0) as renewal_overdue_count,
                u.coins
         FROM servers s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.renewal_next_due_at IS NOT NULL
           AND s.renewal_next_due_at != ''
           AND datetime(s.renewal_next_due_at) <= datetime(?)
           AND (
                s.renewal_last_processed_at IS NULL OR
                datetime(s.renewal_last_processed_at) < datetime(s.renewal_next_due_at)
           )`,
        [nowIso]
    );

    for (const row of dueRows || []) {
        const dueAt = row.renewal_next_due_at;
        const dueAtDate = new Date(dueAt || '');
        if (maxAllowedDueDate && !Number.isNaN(maxAllowedDueDate.getTime()) && !Number.isNaN(dueAtDate.getTime())) {
            // Safety guard: never process deductions for rows already beyond one allowed extension window.
            if (dueAtDate.getTime() > maxAllowedDueDate.getTime()) {
                await writeRenewalEvent({
                    serverId: row.id,
                    userId: row.user_id,
                    dueAt,
                    amount: settings.renewal_coins_per_cycle,
                    mode: settings.renewal_deduction_mode || 'manual',
                    result: 'skipped_max_window',
                    notes: 'Skipped processing because server is already beyond one-cycle renewal window.'
                });
                continue;
            }
        }
        const nextDue = addFrequency(dueAt, settings.renewal_frequency);
        if (!nextDue) continue;

        if (settings.renewal_deduction_mode === 'auto') {
            const deductResult = await run(
                'UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?',
                [settings.renewal_coins_per_cycle, row.user_id, settings.renewal_coins_per_cycle]
            );

            if (deductResult?.changes > 0) {
                await run(
                    `UPDATE servers
                     SET renewal_next_due_at = ?, renewal_last_processed_at = ?, renewal_status = 'active', renewal_overdue_count = 0
                     WHERE id = ?`,
                    [nextDue, dueAt, row.id]
                );
                await maybeSetServerSuspension(row, false);
                await writeRenewalEvent({
                    serverId: row.id,
                    userId: row.user_id,
                    dueAt,
                    amount: settings.renewal_coins_per_cycle,
                    mode: 'auto',
                    result: 'paid',
                    notes: 'Auto deducted successfully'
                });
            } else {
                const newOverdue = Number(row.renewal_overdue_count || 0) + 1;
                const shouldSuspend = newOverdue > settings.renewal_grace_cycles;
                await run(
                    `UPDATE servers
                     SET renewal_next_due_at = ?, renewal_last_processed_at = ?, renewal_status = ?, renewal_overdue_count = ?
                     WHERE id = ?`,
                    [nextDue, dueAt, shouldSuspend ? 'suspended' : 'overdue', newOverdue, row.id]
                );
                await maybeSetServerSuspension(row, shouldSuspend);
                await writeRenewalEvent({
                    serverId: row.id,
                    userId: row.user_id,
                    dueAt,
                    amount: settings.renewal_coins_per_cycle,
                    mode: 'auto',
                    result: shouldSuspend ? 'suspended' : 'insufficient',
                    notes: shouldSuspend ? 'Auto deduction failed; suspended after grace limit.' : 'Auto deduction failed due to insufficient coins.'
                });
            }
            continue;
        }

        // Manual mode: do not deduct automatically; mark due cycle as pending/overdue.
        const newOverdue = Number(row.renewal_overdue_count || 0) + 1;
        const shouldSuspend = newOverdue > settings.renewal_grace_cycles;
        await run(
            `UPDATE servers
             SET renewal_next_due_at = ?, renewal_last_processed_at = ?, renewal_status = ?, renewal_overdue_count = ?
             WHERE id = ?`,
            [nextDue, dueAt, shouldSuspend ? 'suspended' : 'overdue', newOverdue, row.id]
        );
        await maybeSetServerSuspension(row, shouldSuspend);
        await writeRenewalEvent({
            serverId: row.id,
            userId: row.user_id,
            dueAt,
            amount: settings.renewal_coins_per_cycle,
            mode: 'manual',
            result: shouldSuspend ? 'suspended' : 'manual_due',
            notes: shouldSuspend ? 'Manual renewal overdue beyond grace cycles.' : 'Manual renewal due; awaiting admin deduction.'
        });
    }
}

async function manuallyDeductRenewal(serverId, adminUserId = null) {
    const settings = await getRenewalSettings();
    if (!settings.renewal_enabled || settings.renewal_coins_per_cycle <= 0) {
        return { success: false, message: 'Renewal system is disabled or amount is zero.' };
    }

    const server = await get(
        `SELECT s.id, s.user_id, s.pterodactyl_id, s.name, COALESCE(s.renewal_overdue_count, 0) as renewal_overdue_count, s.renewal_status,
                s.renewal_next_due_at, u.coins
         FROM servers s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`,
        [serverId]
    );
    if (!server) {
        return { success: false, message: 'Server not found.' };
    }
    if (String(server.renewal_status || '').toLowerCase() === 'disabled') {
        return { success: false, message: 'This server is not currently tracked by renewal settings.' };
    }

    const currentDue = new Date(server.renewal_next_due_at || '');
    if (Number.isNaN(currentDue.getTime())) {
        return { success: false, message: 'Server renewal due time is not initialized yet.' };
    }

    // Same rule as user self-renew:
    // allow extending only when current due is within one cycle from now.
    const now = new Date();
    const maxAllowedDue = addFrequency(now.toISOString(), settings.renewal_frequency);
    const maxAllowedDueDate = maxAllowedDue ? new Date(maxAllowedDue) : null;
    if (!maxAllowedDueDate || Number.isNaN(maxAllowedDueDate.getTime())) {
        return { success: false, message: 'Unable to evaluate renewal window.' };
    }
    if (currentDue.getTime() > maxAllowedDueDate.getTime()) {
        return { success: false, message: 'The user has already used maximum renewable cycles.' };
    }

    const deductResult = await run(
        'UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?',
        [settings.renewal_coins_per_cycle, server.user_id, settings.renewal_coins_per_cycle]
    );
    if (!deductResult || deductResult.changes === 0) {
        return { success: false, message: 'Insufficient coins for manual renewal deduction.' };
    }

    const nextDue = addFrequency(currentDue.toISOString(), settings.renewal_frequency);
    if (!nextDue) {
        return { success: false, message: 'Unable to compute next renewal due date.' };
    }

    const newOverdue = Math.max(0, Number(server.renewal_overdue_count || 0) - 1);
    const newStatus = newOverdue > 0 ? 'overdue' : 'active';
    await run(
        `UPDATE servers
         SET renewal_next_due_at = ?, renewal_overdue_count = ?, renewal_status = ?
         WHERE id = ?`,
        [nextDue, newOverdue, newStatus, server.id]
    );
    if (newStatus === 'active') {
        await maybeSetServerSuspension(server, false);
    }

    await writeRenewalEvent({
        serverId: server.id,
        userId: server.user_id,
        dueAt: null,
        amount: settings.renewal_coins_per_cycle,
        mode: 'manual',
        result: 'paid',
        notes: adminUserId ? `Manual deduction by admin user ${adminUserId}` : 'Manual deduction from admin panel'
    });

    return { success: true, message: 'Manual renewal deduction completed.' };
}

function start() {
    if (intervalId) return;
    processDueRenewalsOnce().catch(() => {});
    intervalId = setInterval(() => {
        processDueRenewalsOnce().catch(() => {});
    }, POLL_INTERVAL_MS);
}

function stop() {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
}

module.exports = {
    start,
    stop,
    processDueRenewalsOnce,
    manuallyDeductRenewal,
    getRenewalSettings,
    addFrequency
};


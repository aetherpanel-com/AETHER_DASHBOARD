// Daily login reward API routes

const express = require('express');
const router = express.Router();

const { get, query, run, transaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { writeLog } = require('../utils/auditLog');

function utcDateString(date = new Date()) {
    // YYYY-MM-DD in UTC
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
        .toISOString()
        .slice(0, 10);
}

function utcYesterdayString(date = new Date()) {
    const y = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    y.setUTCDate(y.getUTCDate() - 1);
    return y.toISOString().slice(0, 10);
}

function normalizeClaimDate(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const dateOnlyMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnlyMatch) return dateOnlyMatch[1];
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return utcDateString(parsed);
}

function utcDayDiff(fromDateString, toDateString) {
    if (!fromDateString || !toDateString) return null;
    const from = new Date(`${fromDateString}T00:00:00Z`);
    const to = new Date(`${toDateString}T00:00:00Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

router.get('/api/status', requireAuth, async (req, res) => {
    try {
        const today = utcDateString();

        const flag = await get(
            `SELECT enabled FROM feature_flags WHERE name = ?`,
            ['daily_rewards']
        );
        const enabled = flag ? Number(flag.enabled) === 1 : false;

        const user = await get(
            `SELECT streak_day, streak_last_claim FROM users WHERE id = ?`,
            [req.session.user.id]
        );

        let nextDay = 1;
        let streak = 0;

        const lastClaim = normalizeClaimDate(user?.streak_last_claim || null);
        const storedStreakDay = Number(user?.streak_day || 0);
        const daysSinceLastClaim = lastClaim ? utcDayDiff(lastClaim, today) : null;
        const claimed = daysSinceLastClaim === 0;

        if (claimed) {
            streak = storedStreakDay;
        } else if (daysSinceLastClaim === 1) {
            streak = storedStreakDay;
        } else {
            // Streak reset if last claim wasn't yesterday.
            streak = 0;
            // Keep DB in sync so stale streak values cannot leak into later claims.
            if (storedStreakDay > 0) {
                await run(
                    `UPDATE users SET streak_day = 0 WHERE id = ?`,
                    [req.session.user.id]
                );
            }
        }

        if (claimed) {
            // Already claimed today — next day is the one after current streak
            nextDay = storedStreakDay >= 7 ? 1 : storedStreakDay + 1;
        } else if (daysSinceLastClaim === 1) {
            // Streak continuing — next claim will be the next day
            nextDay = storedStreakDay >= 7 ? 1 : storedStreakDay + 1;
        } else {
            // Streak broken or fresh start
            nextDay = 1;
        }

        const rewards = await query(
            `SELECT day_number, coins FROM daily_reward_config ORDER BY day_number ASC`
        );

        return res.json({
            enabled,
            claimed,
            streak,
            next_day: nextDay,
            rewards
        });
    } catch (error) {
        console.error('Daily reward status error:', error);
        res.status(500).json({ success: false, message: 'Error fetching daily reward status' });
    }
});

router.post('/api/claim', requireAuth, async (req, res) => {
    try {
        const today = utcDateString();

        const flag = await get(
            `SELECT enabled FROM feature_flags WHERE name = ?`,
            ['daily_rewards']
        );
        const enabled = flag ? Number(flag.enabled) === 1 : false;

        if (!enabled) {
            return res.status(403).json({ success: false, message: 'Daily rewards are disabled' });
        }

        const result = await transaction(async () => {
            const user = await get(
                `SELECT coins, streak_day, streak_last_claim FROM users WHERE id = ?`,
                [req.session.user.id]
            );

            if (!user) {
                throw new Error('User not found');
            }

            const normalizedLastClaim = normalizeClaimDate(user.streak_last_claim || null);
            const daysSinceLastClaim = normalizedLastClaim ? utcDayDiff(normalizedLastClaim, today) : null;

            if (daysSinceLastClaim === 0) {
                const err = new Error('Already claimed today');
                err.code = 'ALREADY_CLAIMED';
                throw err;
            }

            const storedStreakDay = Number(user.streak_day || 0);

            // Missing even a single day resets streak to Day 1.
            const isConsecutive = daysSinceLastClaim === 1;
            const nextDay = isConsecutive ? (storedStreakDay >= 7 ? 1 : storedStreakDay + 1) : 1;

            const rewardRow = await get(
                `SELECT coins FROM daily_reward_config WHERE day_number = ?`,
                [nextDay]
            );

            const coinsAwarded = Number(rewardRow?.coins || 0);

            await run(
                `UPDATE users
                 SET coins = coins + ?, streak_day = ?, streak_last_claim = ?
                 WHERE id = ?`,
                [coinsAwarded, nextDay, today, req.session.user.id]
            );

            const newBalanceRow = await get(
                `SELECT coins FROM users WHERE id = ?`,
                [req.session.user.id]
            );

            return { coinsAwarded, newBalance: newBalanceRow?.coins || 0, nextDay };
        });

        res.json({
            success: true,
            coins_awarded: result.coinsAwarded,
            new_balance: result.newBalance,
            streak_day: result.nextDay,
            message: `Daily reward claimed (Day ${result.nextDay}).`
        });
        writeLog(
            req.session.user.id,
            req.session.user.username,
            'coins_earned_daily_reward',
            `Claimed Day ${result.nextDay} daily reward: ${result.coinsAwarded} coins`
        ).catch(() => {});
        return;
    } catch (error) {
        if (error?.code === 'ALREADY_CLAIMED') {
            return res.status(400).json({ success: false, message: 'Already claimed today' });
        }
        console.error('Daily reward claim error:', error);
        res.status(500).json({ success: false, message: 'Error claiming daily reward' });
    }
});

module.exports = router;


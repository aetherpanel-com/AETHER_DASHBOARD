// Referral system routes + shared processReferral helper

const express = require('express');
const router = express.Router();

const { get, query, run, transaction } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const referralChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCodeFromUserId(userId, attempt = 0) {
    // Base-encode with the provided alphabet (deterministic for a given userId).
    // We additionally clamp to 6-8 chars to match the requested format.
    let n = Math.max(0, parseInt(userId) + attempt);
    let code = '';
    do {
        code = referralChars[n % referralChars.length] + code;
        n = Math.floor(n / referralChars.length);
    } while (n > 0);

    while (code.length < 6) code = referralChars[0] + code;
    if (code.length > 8) code = code.slice(-8);
    return code;
}

async function isReferralSystemEnabled() {
    const flag = await get(`SELECT enabled FROM feature_flags WHERE name = ?`, ['referral_system']);
    return flag ? Number(flag.enabled) === 1 : false;
}

function referralLink(code) {
    return `/auth/register?ref=${encodeURIComponent(code)}`;
}

router.get('/api/info', requireAuth, async (req, res) => {
    try {
        const enabled = await isReferralSystemEnabled();
        const user = await get(
            'SELECT id, referral_code, referred_by, referral_coins_earned FROM users WHERE id = ?',
            [req.session.user.id]
        );

        const config = await get(
            'SELECT referrer_reward, referee_reward FROM referral_config ORDER BY id DESC LIMIT 1'
        );

        const totalReferralsRow = await get(
            'SELECT COUNT(*) as count FROM users WHERE referred_by = ?',
            [req.session.user.id]
        );

        res.json({
            enabled,
            referral_code: user?.referral_code || null,
            referral_link: user?.referral_code ? referralLink(user.referral_code) : null,
            total_referrals: totalReferralsRow?.count || 0,
            coins_earned: user?.referral_coins_earned || 0,
            referrer_reward: Number(config?.referrer_reward || 0),
            referee_reward: Number(config?.referee_reward || 0)
        });
    } catch (error) {
        console.error('Referral info error:', error);
        res.status(500).json({ success: false, message: 'Error fetching referral info' });
    }
});

router.get('/api/list', requireAuth, async (req, res) => {
    try {
        const enabled = await isReferralSystemEnabled();
        if (!enabled) {
            return res.json({ enabled: false, users: [] });
        }

        const users = await query(
            `SELECT id, username, email, coins, referred_by, created_at
             FROM users
             WHERE referred_by = ?
             ORDER BY created_at DESC`,
            [req.session.user.id]
        );

        res.json({ enabled: true, users: users || [] });
    } catch (error) {
        console.error('Referral list error:', error);
        res.status(500).json({ success: false, message: 'Error fetching referral list' });
    }
});

async function processReferral(newUserId, refCode, app) {
    const enabled = await isReferralSystemEnabled();
    if (!enabled) return { enabled: false };

    if (!refCode || typeof refCode !== 'string') return { enabled: true, applied: false };
    const cleanCode = refCode.trim();
    if (!cleanCode) return { enabled: true, applied: false };

    const referrer = await get(
        'SELECT id, coins, referral_coins_earned FROM users WHERE referral_code = ?',
        [cleanCode]
    );
    if (!referrer || Number(referrer.id) === Number(newUserId)) {
        return { enabled: true, applied: false };
    }

    // Idempotency: if the new user is already referred, do not double-award.
    const newUser = await get(
        'SELECT id, referred_by FROM users WHERE id = ?',
        [newUserId]
    );
    if (!newUser) return { enabled: true, applied: false };
    if (newUser.referred_by) {
        return { enabled: true, applied: false, reason: 'Already referred' };
    }

    const config = await get(
        'SELECT referrer_reward, referee_reward FROM referral_config ORDER BY id DESC LIMIT 1'
    );
    const referrerReward = Number(config?.referrer_reward || 0);
    const refereeReward = Number(config?.referee_reward || 0);

    let applied = false;
    await transaction(async () => {
        // Award referee + set referred_by only if not already referred.
        const refereeUpdate = await run(
            `UPDATE users
             SET coins = coins + ?,
                 referred_by = ?
             WHERE id = ? AND referred_by IS NULL`,
            [refereeReward, referrer.id, newUserId]
        );

        if ((refereeUpdate?.changes || 0) === 0) return;

        // Only award the referrer if the referee update actually happened.
        await run(
            `UPDATE users
             SET coins = coins + ?,
                 referral_coins_earned = COALESCE(referral_coins_earned, 0) + ?
             WHERE id = ?`,
            [referrerReward, referrerReward, referrer.id]
        );

        applied = true;
    });

    if (!applied) {
        return { enabled: true, applied: false, reason: 'Already referred' };
    }

    return {
        enabled: true,
        applied: true,
        referrer_reward: referrerReward,
        referee_reward: refereeReward
    };
}

module.exports = router;
module.exports.processReferral = processReferral;
module.exports.generateReferralCodeFromUserId = generateReferralCodeFromUserId;


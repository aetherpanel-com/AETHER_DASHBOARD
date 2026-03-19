// User onboarding checklist (bit flags in users.onboarding_flags)

const express = require('express');
const router = express.Router();

const { get, run } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const DISMISSED_BIT = 4; // 16

const STEPS = [
    { bit: 0, key: 'earned_coins', label: 'Earn your first coins', link: '/linkvertise', icon: '🪙' },
    { bit: 1, key: 'purchased_resource', label: 'Purchase server resources', link: '/servers/store', icon: '📦' },
    { bit: 2, key: 'created_server', label: 'Create your first server', link: '/servers', icon: '🚀' },
    { bit: 3, key: 'visited_server', label: 'Open your server details', link: '/servers', icon: '🖥️' }
];

function bitMask(bit) {
    return 1 << bit;
}

async function markStep(userId, bit) {
    if (userId == null) return false;
    const mask = bitMask(bit);

    try {
        await run(
            `UPDATE users
             SET onboarding_flags = COALESCE(onboarding_flags, 0) | ?
             WHERE id = ?`,
            [mask, userId]
        );
        return true;
    } catch (e) {
        console.error('[onboarding] markStep failed:', e);
        return false;
    }
}

router.get('/api/status', requireAuth, async (req, res) => {
    try {
        const flagsRow = await get(
            'SELECT onboarding_flags FROM users WHERE id = ?',
            [req.session.user.id]
        );

        const flags = Number(flagsRow?.onboarding_flags || 0);
        const dismissed = (flags & bitMask(DISMISSED_BIT)) !== 0;

        const steps = STEPS.map(s => {
            const done = (flags & bitMask(s.bit)) !== 0;
            return {
                key: s.key,
                label: s.label,
                link: s.link,
                icon: s.icon,
                done
            };
        });

        const allDone = steps.every(s => s.done);

        return res.json({
            steps,
            allDone,
            dismissed
        });
    } catch (e) {
        console.error('[onboarding] status error:', e);
        res.status(500).json({ success: false, message: 'Error fetching onboarding status' });
    }
});

router.post('/api/complete-step', requireAuth, async (req, res) => {
    try {
        const stepKey = req.body?.step;
        const step = STEPS.find(s => s.key === stepKey);
        if (!step) {
            return res.status(400).json({ success: false, message: 'Invalid step' });
        }

        await markStep(req.session.user.id, step.bit);
        return res.json({ success: true });
    } catch (e) {
        console.error('[onboarding] complete-step error:', e);
        res.status(500).json({ success: false, message: 'Error completing onboarding step' });
    }
});

router.post('/api/dismiss', requireAuth, async (req, res) => {
    try {
        await markStep(req.session.user.id, DISMISSED_BIT);
        return res.json({ success: true });
    } catch (e) {
        console.error('[onboarding] dismiss error:', e);
        res.status(500).json({ success: false, message: 'Error dismissing onboarding checklist' });
    }
});

module.exports = router;
module.exports.markStep = markStep;


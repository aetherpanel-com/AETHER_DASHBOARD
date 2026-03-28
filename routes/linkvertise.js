// Linkvertise Routes
// Handles Linkvertise links and coin earning

const express = require('express');
const router = express.Router();
const path = require('path');
const { db, query, get, run, transaction } = require('../config/database');
const { linkvertiseLimiter, apiLimiter } = require('../middleware/rateLimit');
const { markStep } = require('./onboarding');
const { sendBrandedView } = require('../config/brandingHelper');
const { writeLog } = require('../utils/auditLog');

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Linkvertise page
router.get('/', requireAuth, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/linkvertise.html'));
});

// API endpoint to get available links
router.get('/api/links', requireAuth, async (req, res) => {
    try {
        // Get active links from database
        const activeLinks = await query(
            'SELECT * FROM linkvertise_links WHERE is_active = 1 ORDER BY priority DESC, created_at ASC'
        );
        
        // Get cooldown configuration
        const config = await get('SELECT cooldown_seconds FROM linkvertise_config ORDER BY id DESC LIMIT 1');
        const cooldownSeconds = (config && config.cooldown_seconds) ? config.cooldown_seconds : 30;
        
        // Get user's last completion time for each link
        const lastCompletions = await query(
            'SELECT link_id, completed_at FROM linkvertise_completions WHERE user_id = ? ORDER BY completed_at DESC',
            [req.session.user.id]
        );
        
        // Create a map of link_id to last completion time
        // BUGFIX: Store both integer and string keys for consistent lookup
        const completionMap = {};
        lastCompletions.forEach(completion => {
            const linkIdInt = parseInt(completion.link_id);
            const linkIdStr = linkIdInt.toString();
            const existingTime = completionMap[linkIdStr] || completionMap[linkIdInt];
            
            if (!existingTime || 
                new Date(completion.completed_at) > new Date(existingTime)) {
                // Store with both keys for backward compatibility
                completionMap[linkIdStr] = completion.completed_at;
                completionMap[linkIdInt] = completion.completed_at;
            }
        });
        
        // BUGFIX #12: Mark which links are completed and calculate cooldown
        // Use Date.now() for consistent UTC milliseconds comparison
        const nowMs = Date.now();
        const linksWithStatus = await Promise.all(activeLinks.map(async link => {
            // BUGFIX: Normalize link ID to integer for consistent comparison
            const linkIdInt = parseInt(link.id);
            const linkIdStr = linkIdInt.toString();
            // Check both string and integer keys in completion map for backward compatibility
            const lastCompletion = completionMap[linkIdStr] || completionMap[linkIdInt];
            let cooldownRemaining = 0;
            let isOnCooldown = false;
            
            if (lastCompletion) {
                try {
                    // SQLite CURRENT_TIMESTAMP stores in UTC as 'YYYY-MM-DD HH:MM:SS' format
                    // Parse it as UTC by appending 'Z' to the ISO-formatted string
                    const lastCompletionTime = new Date(lastCompletion.replace(' ', 'T') + 'Z').getTime();
                    const secondsSinceCompletion = Math.floor((nowMs - lastCompletionTime) / 1000);
                    cooldownRemaining = Math.max(0, cooldownSeconds - secondsSinceCompletion);
                    isOnCooldown = cooldownRemaining > 0;
                } catch (timestampError) {
                    console.error('Error parsing completion timestamp for link', linkIdInt, ':', timestampError);
                    // If parsing fails, assume no cooldown
                    cooldownRemaining = 0;
                    isOnCooldown = false;
                }
            }
            
            let result = {
                id: linkIdStr,
                title: link.title,
                url: link.url,
                coins_earned: link.coins_earned,
                completed: !!lastCompletion,
                on_cooldown: isOnCooldown,
                cooldown_remaining: cooldownRemaining,
                cooldown_seconds: cooldownSeconds
            };
            
            // Per-link rate limit enforcement logic for the UI frontend
            if (link.max_completions > 0) {
                const countResult = await get(
                    `SELECT COUNT(*) as count FROM linkvertise_completions WHERE user_id = ? AND link_id = ? AND completed_at >= datetime('now', ?)`,
                    [req.session.user.id, linkIdInt, `-${link.completion_window_hours || 24} hours`]
                );
                const count = countResult ? countResult.count : 0;
                result.limit_reached = count >= link.max_completions;
                result.max_completions = link.max_completions;
                result.completion_window_hours = link.completion_window_hours || 24;
                result.current_completions = count;
            } else {
                result.limit_reached = false;
            }
            
            return result;
        }));
        
        res.json({ success: true, links: linksWithStatus });
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({ success: false, message: 'Error fetching links' });
    }
});

// API endpoint to start the link process (sets session token/timer)
router.post('/api/start', requireAuth, linkvertiseLimiter, async (req, res) => {
    try {
        const { link_id } = req.body;
        
        if (!link_id) {
            return res.status(400).json({ success: false, message: 'Link ID is required' });
        }
        
        const linkIdInt = parseInt(link_id);
        if (isNaN(linkIdInt) || linkIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid link ID format' });
        }
        
        // Anti-exploit: Enforce per-link rate limit on start
        const link = await get('SELECT max_completions, completion_window_hours FROM linkvertise_links WHERE id = ?', [linkIdInt]);
        if (link && link.max_completions > 0) {
            const countResult = await get(
                `SELECT COUNT(*) as count FROM linkvertise_completions WHERE user_id = ? AND link_id = ? AND completed_at >= datetime('now', ?)`,
                [req.session.user.id, linkIdInt, `-${link.completion_window_hours || 24} hours`]
            );
            if (countResult && countResult.count >= link.max_completions) {
                return res.status(400).json({ success: false, message: 'You have reached the maximum completion limit for this link.' });
            }
        }
        
        // Save the start time and pending link in session
        req.session.linkvertise_pending = {
            linkId: linkIdInt,
            timestamp: Date.now()
        };
        
        // Ensure session is saved before returning
        if (req.session.save) {
            req.session.save();
        }

        res.json({ success: true, message: 'Verification session started' });
    } catch (error) {
        console.error('Error starting link verification:', error);
        res.status(500).json({ success: false, message: 'Error starting link verification' });
    }
});

// Verification callback that Linkvertise redirects to
router.get('/verify/:link_id', requireAuth, async (req, res) => {
    try {
        const link_id = req.params.link_id;
        const linkIdInt = parseInt(link_id);
        
        if (isNaN(linkIdInt) || linkIdInt <= 0) {
            return res.redirect('/linkvertise?error=Invalid link ID');
        }
        
        // 1. Check if the session has a pending link verification
        const pending = req.session.linkvertise_pending;
        
        if (!pending || pending.linkId !== linkIdInt) {
            return res.redirect('/linkvertise?error=Verification session missing. Please start the link from the dashboard again.');
        }
        
        // 2. Check the minimum time elapsed (15 seconds)
        const timeElapsed = Date.now() - pending.timestamp;
        const minimumTimeMs = 15000; // 15 seconds
        
        if (timeElapsed < minimumTimeMs) {
            // Cleared so they have to start over properly
            delete req.session.linkvertise_pending;
            if (req.session.save) req.session.save();
            return res.redirect('/linkvertise?error=You skipped the verification too quickly. Please complete the ads properly.');
        }
        
        // Clear the pending session to prevent reuse
        delete req.session.linkvertise_pending;
        if (req.session.save) req.session.save();
        
        // Proceed with previous database checks and earning
        const link = await get(
            'SELECT id, coins_earned, is_active FROM linkvertise_links WHERE id = ?',
            [linkIdInt]
        );
        
        if (!link) {
            return res.redirect('/linkvertise?error=Link not found');
        }
        
        if (!link.is_active) {
            return res.redirect('/linkvertise?error=This link is not currently active');
        }
        
        // Get cooldown configuration
        const config = await get('SELECT cooldown_seconds FROM linkvertise_config ORDER BY id DESC LIMIT 1');
        const cooldownSeconds = (config && config.cooldown_seconds) ? config.cooldown_seconds : 30;
        
        // Check last completion time
        const lastCompletion = await get(
            'SELECT completed_at FROM linkvertise_completions WHERE user_id = ? AND link_id = ? ORDER BY completed_at DESC LIMIT 1',
            [req.session.user.id, linkIdInt]
        );
        
        if (lastCompletion) {
            try {
                const lastCompletionTime = new Date(lastCompletion.completed_at.replace(' ', 'T') + 'Z').getTime();
                const nowMs = Date.now();
                const secondsSinceCompletion = Math.floor((nowMs - lastCompletionTime) / 1000);
                const remainingSeconds = cooldownSeconds - secondsSinceCompletion;
                
                if (remainingSeconds > 0) {
                    return res.redirect('/linkvertise?error=Please wait before completing this link again.&cooldown=' + remainingSeconds);
                }
            } catch (timestampError) {
                console.error('Error parsing timestamp:', timestampError);
            }
        }
        
        const coinsEarned = link.coins_earned || 10;
        
        await transaction(async () => {
            await run(
                'INSERT INTO linkvertise_completions (user_id, link_id, coins_earned) VALUES (?, ?, ?)',
                [req.session.user.id, linkIdInt, coinsEarned]
            );
            await run(
                'UPDATE users SET coins = coins + ? WHERE id = ?',
                [coinsEarned, req.session.user.id]
            );
        });
        
        req.session.user.coins = (req.session.user.coins || 0) + coinsEarned;

        try {
            await markStep(req.session.user.id, 0);
        } catch (e) {}
        
        writeLog(
            req.session.user.id,
            req.session.user.username,
            'coins_earned_linkvertise',
            `Earned ${coinsEarned} coins via Linkvertise link '${link.title || link.id}'`
        ).catch(() => {});
        
        res.redirect(`/linkvertise?success=true&coins=${coinsEarned}`);
    } catch (error) {
        console.error('Error verifying link:', error);
        res.redirect('/linkvertise?error=An unexpected error occurred. Please try again.');
    }
});

// Helper function to get coins for a link
async function getCoinsForLink(linkId) {
    try {
        const link = await get('SELECT coins_earned FROM linkvertise_links WHERE id = ?', [linkId]);
        return link ? link.coins_earned : 10;
    } catch (error) {
        console.error('Error getting link coins:', error);
        return 10;
    }
}

// API endpoint to get completion history
router.get('/api/history', requireAuth, async (req, res) => {
    try {
        const completions = await query(
            `SELECT lc.link_id, lc.coins_earned, lc.completed_at, ll.title as link_title
             FROM linkvertise_completions lc
             LEFT JOIN linkvertise_links ll ON lc.link_id = ll.id
             WHERE lc.user_id = ? 
             ORDER BY lc.completed_at DESC 
             LIMIT 2`,
            [req.session.user.id]
        );
        
        res.json({ success: true, completions });
    } catch (error) {
        console.error('Error fetching completion history:', error);
        res.status(500).json({ success: false, message: 'Error fetching history' });
    }
});

// Public (authenticated) Adsterra embeds — no admin secrets returned.
// Query: placement_key = linkvertise_below_history | global_header (default: linkvertise_below_history)
const ADSTERRA_EMBED_KEYS = new Set(['linkvertise_below_history', 'global_header']);

router.get('/api/adsterra/embed', requireAuth, apiLimiter, async (req, res) => {
    try {
        const rawKey = String(req.query?.placement_key || 'linkvertise_below_history').trim().toLowerCase();
        const placementKey = ADSTERRA_EMBED_KEYS.has(rawKey) ? rawKey : 'linkvertise_below_history';

        const config = await get('SELECT enabled FROM adsterra_config ORDER BY id DESC LIMIT 1');
        if (!config || Number(config.enabled) !== 1) {
            return res.json({ success: true, enabled: false, placements: [], placement_key: placementKey });
        }

        const rows = await query(
            `SELECT id, ad_code, script_placement, target_devices, sort_order
             FROM adsterra_placements
             WHERE placement_key = ?
               AND is_active = 1
               AND ad_code IS NOT NULL
               AND TRIM(ad_code) != ''
             ORDER BY sort_order ASC, id ASC`,
            [placementKey]
        );

        const placements = (rows || []).map((r) => ({
            id: r.id,
            ad_code: String(r.ad_code || ''),
            script_placement: String(r.script_placement || 'inline').toLowerCase(),
            target_devices: String(r.target_devices || 'all').toLowerCase(),
            sort_order: Number(r.sort_order) || 0
        }));

        res.json({ success: true, enabled: true, placement_key: placementKey, placements });
    } catch (error) {
        console.error('Error loading Adsterra embed config:', error);
        res.status(500).json({ success: false, message: 'Error loading ad configuration' });
    }
});

module.exports = router;


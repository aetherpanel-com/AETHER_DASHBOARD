// Linkvertise Routes
// Handles Linkvertise links and coin earning

const express = require('express');
const router = express.Router();
const path = require('path');
const { query, get, run } = require('../config/database');

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Linkvertise page
router.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/linkvertise.html'));
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
        const completionMap = {};
        lastCompletions.forEach(completion => {
            if (!completionMap[completion.link_id] || 
                new Date(completion.completed_at) > new Date(completionMap[completion.link_id])) {
                completionMap[completion.link_id] = completion.completed_at;
            }
        });
        
        // BUGFIX #12: Mark which links are completed and calculate cooldown
        // Use Date.now() for consistent UTC milliseconds comparison
        const nowMs = Date.now();
        const linksWithStatus = activeLinks.map(link => {
            const linkId = link.id.toString();
            const lastCompletion = completionMap[linkId];
            let cooldownRemaining = 0;
            let isOnCooldown = false;
            
            if (lastCompletion) {
                // SQLite CURRENT_TIMESTAMP stores in UTC as 'YYYY-MM-DD HH:MM:SS' format
                // Parse it as UTC by appending 'Z' to the ISO-formatted string
                const lastCompletionTime = new Date(lastCompletion.replace(' ', 'T') + 'Z').getTime();
                const secondsSinceCompletion = Math.floor((nowMs - lastCompletionTime) / 1000);
                cooldownRemaining = Math.max(0, cooldownSeconds - secondsSinceCompletion);
                isOnCooldown = cooldownRemaining > 0;
            }
            
            return {
                id: linkId,
                title: link.title,
                url: link.url,
                coins_earned: link.coins_earned,
                completed: !!lastCompletion,
                on_cooldown: isOnCooldown,
                cooldown_remaining: cooldownRemaining,
                cooldown_seconds: cooldownSeconds
            };
        });
        
        console.log(`Cooldown config: ${cooldownSeconds} seconds`); // Debug
        console.log(`Links with status:`, linksWithStatus); // Debug
        
        res.json({ success: true, links: linksWithStatus });
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({ success: false, message: 'Error fetching links' });
    }
});

// API endpoint to complete a link and earn coins
router.post('/api/complete', requireAuth, async (req, res) => {
    try {
        const { link_id } = req.body;
        
        if (!link_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Link ID is required' 
            });
        }
        
        // Get cooldown configuration
        const config = await get('SELECT cooldown_seconds FROM linkvertise_config ORDER BY id DESC LIMIT 1');
        const cooldownSeconds = (config && config.cooldown_seconds) ? config.cooldown_seconds : 30;
        
        // Check last completion time for this user and link
        const lastCompletion = await get(
            'SELECT completed_at FROM linkvertise_completions WHERE user_id = ? AND link_id = ? ORDER BY completed_at DESC LIMIT 1',
            [req.session.user.id, link_id]
        );
        
        if (lastCompletion) {
            // BUGFIX #12: Parse SQLite timestamp correctly to avoid timezone issues
            // SQLite CURRENT_TIMESTAMP stores in UTC, use Date.now() for consistent UTC comparison
            const lastCompletionTime = new Date(lastCompletion.completed_at.replace(' ', 'T') + 'Z').getTime();
            const nowMs = Date.now();
            const secondsSinceCompletion = Math.floor((nowMs - lastCompletionTime) / 1000);
            const remainingSeconds = cooldownSeconds - secondsSinceCompletion;
            
            if (remainingSeconds > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Please wait ${remainingSeconds} more second${remainingSeconds !== 1 ? 's' : ''} before completing this link again.`,
                    cooldown_remaining: remainingSeconds
                });
            }
        }
        
        // Get coins earned from database
        const coinsEarned = await getCoinsForLink(link_id);
        
        // Record completion
        await run(
            'INSERT INTO linkvertise_completions (user_id, link_id, coins_earned) VALUES (?, ?, ?)',
            [req.session.user.id, link_id, coinsEarned]
        );
        
        // Add coins to user's balance
        await run(
            'UPDATE users SET coins = coins + ? WHERE id = ?',
            [coinsEarned, req.session.user.id]
        );
        
        // Update session
        req.session.user.coins = (req.session.user.coins || 0) + coinsEarned;
        
        res.json({ 
            success: true, 
            message: 'Link completed successfully',
            coins_earned: coinsEarned
        });
    } catch (error) {
        console.error('Error completing link:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error completing link' 
        });
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
             LIMIT 50`,
            [req.session.user.id]
        );
        
        res.json({ success: true, completions });
    } catch (error) {
        console.error('Error fetching completion history:', error);
        res.status(500).json({ success: false, message: 'Error fetching history' });
    }
});

module.exports = router;


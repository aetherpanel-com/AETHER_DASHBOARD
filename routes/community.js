// Community Routes
// Handles Community page (Discord Chat and Invite Rewards)

const express = require('express');
const router = express.Router();
const path = require('path');
const axios = require('axios');
const { db, query, get } = require('../config/database');
const { sendBrandedView } = require('../config/brandingHelper');

// Middleware to check if user is logged in
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Community page
router.get('/', requireAuth, async (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/community.html'));
});

// GET /api/community/discord-config
// Endpoint to get Discord config for frontend (chat enabled status)
router.get('/discord-config', requireAuth, async (req, res) => {
    try {
        const config = await get('SELECT enable_chat FROM discord_config ORDER BY id DESC LIMIT 1');
        res.json({
            success: true,
            enable_chat: config ? (config.enable_chat === 1) : true
        });
    } catch (error) {
        console.error('Error fetching Discord config:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching configuration'
        });
    }
});

// POST /api/community/send-message
// Endpoint to send chat messages to Discord bot
router.post('/send-message', requireAuth, async (req, res) => {
    try {
        const { username, message } = req.body;
        
        // Validate message is not empty
        if (!message || !message.trim()) {
            return res.json({
                success: false
            });
        }
        
        // Check if Discord chat is enabled
        const discordConfig = await get('SELECT enable_chat FROM discord_config ORDER BY id DESC LIMIT 1');
        if (!discordConfig || discordConfig.enable_chat !== 1) {
            return res.status(403).json({
                success: false,
                error: 'Discord chat is disabled by the administrator'
            });
        }
        
        // Log the message in dashboard terminal
        console.log('Dashboard chat message');
        console.log(`User: ${username || req.session.user.username || 'Unknown'}`);
        console.log(`Message: ${message}`);
        
        // Send message to Discord bot API
        const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3001';
        const botApiKey = process.env.BOT_API_KEY;
        
        try {
            await axios.post(
                `${botApiUrl}/bot/send-message`,
                {
                    username: username || req.session.user.username || 'Dashboard User',
                    message: message
                },
                {
                    headers: {
                        'Authorization': `Bearer ${botApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (botError) {
            console.error('Failed to send message to Discord bot:', botError.message);
            // Continue even if bot API fails - return success to user
        }
        
        // Broadcast message to all connected WebSocket clients immediately
        const io = req.app.get('io');
        if (io) {
            io.emit('discord_message', {
                username: username || req.session.user.username || 'Dashboard User',
                avatar: null, // Dashboard messages don't have Discord avatars
                message: message,
                timestamp: Date.now()
            });
        }
        
        // Return success response
        res.json({
            success: true
        });
        
    } catch (error) {
        console.error('Error processing chat message:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/invites/stats
// Endpoint to get invite statistics for the current user
router.get('/invites/stats', requireAuth, async (req, res) => {
    try {
        const { get, query } = require('../config/database');
        const currentUsername = req.session.user.username;
        
        // Count invites for the current user
        const inviteCountResult = await query(`
            SELECT COUNT(*) as count
            FROM discord_invites
            WHERE inviter = ? AND rewarded = 1
        `, [currentUsername]);
        
        const invites = inviteCountResult && inviteCountResult.length > 0 ? inviteCountResult[0].count : 0;
        
        // Get reward per invite from Discord config (safe fallback if table is missing)
        let discordConfig = null;
        try {
            discordConfig = await get('SELECT reward_per_invite FROM discord_config ORDER BY id DESC LIMIT 1');
        } catch (e) {
            // discord_config table may not exist yet
        }
        const rewardPerInvite = discordConfig ? (discordConfig.reward_per_invite || 0) : 0;
        
        // Calculate coins earned (invites * reward per invite)
        const coinsEarned = invites * rewardPerInvite;
        
        // Return stats
        res.json({
            invites: invites,
            coinsEarned: coinsEarned,
            rewardPerInvite: rewardPerInvite
        });
        
    } catch (error) {
        console.error('Error fetching invite stats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/invites/leaderboard
// Endpoint to get top inviters leaderboard
router.get('/invites/leaderboard', requireAuth, async (req, res) => {
    try {
        // Query to get invite counts per inviter
        // Group by inviter, count invites
        const leaderboardData = await query(`
            SELECT 
                di.inviter,
                COUNT(*) as invites
            FROM discord_invites di
            WHERE di.rewarded = 1
            GROUP BY di.inviter
            ORDER BY invites DESC
            LIMIT 10
        `);

        // Get reward per invite from Discord config (safe fallback if table is missing)
        let rewardConfig = null;
        try {
            rewardConfig = await get('SELECT reward_per_invite FROM discord_config ORDER BY id DESC LIMIT 1');
        } catch (e) {
            // discord_config table may not exist yet
        }
        const rewardPerInvite = rewardConfig ? (rewardConfig.reward_per_invite || 0) : 0;
        
        // Get usernames from users table for each inviter
        const leaderboard = await Promise.all(
            leaderboardData.map(async (item) => {
                // Get user info to ensure user exists
                const user = await get(
                    'SELECT id, username FROM users WHERE username = ?',
                    [item.inviter]
                );
                
                if (user) {
                    return {
                        userId: user.id,
                        username: user.username,
                        invites: item.invites,
                        coins: item.invites * rewardPerInvite
                    };
                }
                // If user doesn't exist, still return the data but with inviter as username
                return {
                    userId: null,
                    username: item.inviter,
                    invites: item.invites,
                    coins: item.invites * rewardPerInvite
                };
            })
        );
        
        // Return leaderboard data
        res.json(leaderboard);
        
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;

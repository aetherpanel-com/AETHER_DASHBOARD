// Discord Integration Routes
// Handles Discord bot webhook events

const express = require('express');
const router = express.Router();
const { get, run } = require('../config/database');

// Middleware to verify bot API key authentication
function verifyBotAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.BOT_API_KEY;
    
    // Check if Authorization header exists
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Missing Authorization header'
        });
    }
    
    // Extract Bearer token
    const token = authHeader.replace('Bearer ', '');
    
    // Verify token matches BOT_API_KEY
    if (!expectedKey || token !== expectedKey) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid API key'
        });
    }
    
    // Authentication successful
    next();
}


// POST /api/discord/invite-used
// Endpoint for Discord bot to notify dashboard when an invite is used
router.post('/invite-used', verifyBotAuth, async (req, res) => {
    try {
        const { inviter, invite_code, joined_user } = req.body;
        
        // Validate required fields
        if (!inviter || !invite_code || !joined_user) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: inviter, invite_code, joined_user'
            });
        }
        
        // Log the event to console
        console.log('Discord invite used:');
        console.log(`Inviter: ${inviter}`);
        console.log(`Invite Code: ${invite_code}`);
        console.log(`Joined User: ${joined_user}`);
        
        // Check if invite rewards are enabled
        const discordConfig = await get('SELECT enable_invite_rewards, reward_per_invite FROM discord_config ORDER BY id DESC LIMIT 1');
        
        if (!discordConfig || discordConfig.enable_invite_rewards !== 1) {
            // Invite rewards are disabled - return success but skip reward logic
            console.log('Invite rewards are disabled. Skipping reward.');
            return res.json({
                success: true,
                reward: 0,
                reason: 'Invite rewards disabled'
            });
        }
        
        // Check if this joined_user has already been rewarded (abuse protection)
        const existingInvite = await get(
            'SELECT * FROM discord_invites WHERE joined_user = ?',
            [joined_user]
        );
        
        if (existingInvite) {
            // Duplicate invite join detected - reward already given
            console.log('Duplicate invite join detected. Reward skipped.');
            return res.json({
                success: false,
                reason: 'User already rewarded'
            });
        }
        
        // Look up the inviter in the Users table by username
        const inviterUser = await get('SELECT * FROM users WHERE username = ?', [inviter]);
        
        if (!inviterUser) {
            // Inviter not found in database
            return res.json({
                success: false,
                reason: 'Inviter not found'
            });
        }
        
        // Get reward amount from config (default to 100 if not set)
        const reward = discordConfig.reward_per_invite || 100;
        
        // Update the inviter's coins
        await run(
            'UPDATE users SET coins = coins + ? WHERE username = ?',
            [reward, inviter]
        );
        
        // Record the invite in the database to prevent duplicate rewards
        await run(
            'INSERT INTO discord_invites (inviter, joined_user, invite_code, rewarded) VALUES (?, ?, ?, 1)',
            [inviter, joined_user, invite_code]
        );
        
        // Log the reward
        console.log('Discord invite reward granted');
        console.log(`Inviter: ${inviter}`);
        console.log(`Reward: ${reward} coins`);
        console.log(`New User: ${joined_user}`);
        
        // Return success response with reward amount
        res.json({
            success: true,
            reward: reward
        });
        
    } catch (error) {
        console.error('Error processing Discord invite event:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// POST /api/discord/member-left
// Endpoint for Discord bot to notify dashboard when a member leaves
router.post('/member-left', verifyBotAuth, async (req, res) => {
    try {
        const { username } = req.body;
        
        // Validate required fields
        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Missing required field: username'
            });
        }
        
        // Log the event to console
        console.log('Discord member left:');
        console.log(`User: ${username}`);
        
        // Look up the invite record for this joined user
        const inviteRecord = await get(
            'SELECT * FROM discord_invites WHERE joined_user = ?',
            [username]
        );
        
        if (!inviteRecord) {
            // No invite record found - user may have joined before tracking started
            return res.json({
                success: false,
                reason: 'Invite record not found'
            });
        }
        
        // Check if invite rewards are enabled
        const discordConfig = await get('SELECT enable_invite_rewards, reward_per_invite FROM discord_config ORDER BY id DESC LIMIT 1');
        
        if (!discordConfig || discordConfig.enable_invite_rewards !== 1) {
            // Invite rewards are disabled - return success but skip deduction
            console.log('Invite rewards are disabled. Skipping coin deduction.');
            return res.json({
                success: true,
                reason: 'Invite rewards disabled'
            });
        }
        
        // Get the inviter username from the record
        const inviter = inviteRecord.inviter;
        
        // Get reward amount from config (should match the reward given on join)
        const rewardToDeduct = discordConfig.reward_per_invite || 100;
        
        // Deduct coins from the inviter
        await run(
            'UPDATE users SET coins = coins - ? WHERE username = ?',
            [rewardToDeduct, inviter]
        );
        
        // Log the reward removal
        console.log('Removing invite reward');
        console.log(`Inviter: ${inviter}`);
        console.log(`Coins deducted: ${rewardToDeduct}`);
        
        // Return success response
        res.json({
            success: true
        });
        
    } catch (error) {
        console.error('Error processing Discord member leave event:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/discord/config
// Endpoint for Discord bot to fetch configuration
router.get('/config', verifyBotAuth, async (req, res) => {
    try {
        const { get } = require('../config/database');
        
        const config = await get('SELECT * FROM discord_config ORDER BY id DESC LIMIT 1');
        if (config) {
            res.json({ 
                success: true, 
                config: {
                    guild_id: config.guild_id || '',
                    chat_channel_id: config.chat_channel_id || '',
                    invite_channel_id: config.invite_channel_id || '',
                    reward_per_invite: config.reward_per_invite || 100,
                    enable_chat: config.enable_chat === 1,
                    enable_invite_rewards: config.enable_invite_rewards === 1
                }
            });
        } else {
            res.json({ 
                success: true, 
                config: {
                    guild_id: '',
                    chat_channel_id: '',
                    invite_channel_id: '',
                    reward_per_invite: 100,
                    enable_chat: true,
                    enable_invite_rewards: true
                }
            });
        }
    } catch (error) {
        console.error('Error fetching Discord config:', error);
        res.status(500).json({ success: false, message: 'Error fetching configuration' });
    }
});

// POST /api/discord/message
// Endpoint for Discord bot to send chat messages to the dashboard
router.post('/message', verifyBotAuth, async (req, res) => {
    try {
        const { username, avatar, message, timestamp } = req.body;
        
        // Validate required fields
        if (!username || !message) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: username, message'
            });
        }
        
        // Log the message to console
        console.log('Discord chat message received');
        console.log(`User: ${username}`);
        console.log(`Message: ${message}`);
        
        // Broadcast message to all connected WebSocket clients
        const io = req.app.get('io');
        if (io) {
            io.emit('discord_message', {
                username,
                avatar,
                message,
                timestamp
            });
        }
        
        // Return success response
        res.json({
            success: true
        });
        
    } catch (error) {
        console.error('Error processing Discord message:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;

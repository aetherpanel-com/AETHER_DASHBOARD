// Discord Integration Routes
// Handles Discord bot webhook events

const express = require('express');
const router = express.Router();
const { get, run } = require('../config/database');
const { writeLog } = require('../utils/auditLog');

/**
 * GET /api/discord/public-invite
 * Public (no auth): returns whether an admin-configured Discord invite URL exists.
 * Used by the dashboard header join button.
 */
router.get('/public-invite', async (req, res) => {
    try {
        const row = await get(
            'SELECT discord_invite_link FROM discord_config ORDER BY id DESC LIMIT 1'
        );
        const raw = row && row.discord_invite_link != null ? String(row.discord_invite_link).trim() : '';
        if (!raw) {
            return res.json({ success: true, configured: false, url: null });
        }
        return res.json({ success: true, configured: true, url: raw });
    } catch (e) {
        console.error('public-invite error:', e);
        return res.json({ success: true, configured: false, url: null });
    }
});

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
        const discordConfig = await get('SELECT enable_invite_rewards, reward_per_invite, deduct_per_invite FROM discord_config ORDER BY id DESC LIMIT 1');
        
        if (!discordConfig || discordConfig.enable_invite_rewards !== 1) {
            // Invite rewards are disabled - return success but skip reward logic
            console.log('Invite rewards are disabled. Skipping reward.');
            return res.json({
                success: true,
                reward: 0,
                reason: 'Invite rewards disabled'
            });
        }
        
        const existingInvite = await get(
            'SELECT * FROM discord_invites WHERE LOWER(joined_user) = LOWER(?)',
            [joined_user]
        );

        if (existingInvite) {
            // If the user previously left (rewarded = 0), check cooldown before allowing re-reward
            if (existingInvite.rewarded === 0 && existingInvite.left_at) {
                const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
                const timeSinceLeft = Date.now() - existingInvite.left_at;
                if (timeSinceLeft < cooldownMs) {
                    const hoursLeft = Math.ceil((cooldownMs - timeSinceLeft) / (60 * 60 * 1000));
                    console.log(`Rejoin blocked by cooldown. ${hoursLeft}h remaining.`);
                    return res.json({
                        success: false,
                        reason: `Cooldown active. User must wait ${hoursLeft} more hour(s) before rejoining earns a reward.`
                    });
                }
                // Cooldown passed — allow re-reward, update existing record below
            } else if (existingInvite.rewarded === 1) {
                // Still in server and already rewarded — block
                console.log('Duplicate invite join detected. Reward skipped.');
                return res.json({
                    success: false,
                    reason: 'User already rewarded'
                });
            }
        }
        
        // Look up the inviter in the Users table by username (case-insensitive)
        const inviterUser = await get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [inviter]);
        
        if (!inviterUser) {
            // Inviter not found in database
            return res.json({
                success: false,
                reason: 'Inviter not found'
            });
        }
        
        // Get reward amount from config (default to 100 if not set)
        const reward = discordConfig.reward_per_invite || 100;
        
        // Update the inviter's coins using the canonical user ID
        await run(
            'UPDATE users SET coins = coins + ? WHERE id = ?',
            [reward, inviterUser.id]
        );
        
        if (existingInvite) {
            // Re-reward after cooldown passed — update the existing record
            await run(
                'UPDATE discord_invites SET inviter = ?, invite_code = ?, rewarded = 1, coins_awarded = ?, left_at = NULL WHERE LOWER(joined_user) = LOWER(?)',
                [inviterUser.username, invite_code, reward, joined_user]
            );
        } else {
            // First time join — insert new record
            await run(
                'INSERT INTO discord_invites (inviter, joined_user, invite_code, rewarded, coins_awarded) VALUES (?, ?, ?, 1, ?)',
                [inviterUser.username, joined_user, invite_code, reward]
            );
        }
        
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
        writeLog(
            inviterUser.id,
            inviterUser.username,
            'coins_earned_discord_invite',
            `Earned ${reward} coins for Discord invite (joined user: ${joined_user})`
        ).catch(() => {});
        
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
        
        // Look up the invite record for this joined user (case-insensitive)
        const inviteRecord = await get(
            'SELECT * FROM discord_invites WHERE LOWER(joined_user) = LOWER(?)',
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
        const discordConfig = await get('SELECT enable_invite_rewards, reward_per_invite, deduct_per_invite FROM discord_config ORDER BY id DESC LIMIT 1');
        
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
        
        // Use deduct_per_invite if configured, otherwise deduct exact coins_awarded, fallback to reward_per_invite
        const configDeduct = discordConfig.deduct_per_invite || 0;
        const rewardToDeduct = configDeduct > 0
            ? configDeduct
            : (inviteRecord.coins_awarded || discordConfig.reward_per_invite || 100);
        
        // Look up the inviter by username to deduct by ID (more reliable)
        const inviterUser = await get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [inviter]);
        if (inviterUser) {
            await run(
                'UPDATE users SET coins = MAX(0, coins - ?) WHERE id = ?',
                [rewardToDeduct, inviterUser.id]
            );
        }

        // Mark record as left (rewarded = 0) with timestamp for cooldown tracking
        // Do NOT delete — keeps abuse history and enables cooldown check on rejoin
        await run(
            'UPDATE discord_invites SET rewarded = 0, left_at = ? WHERE LOWER(joined_user) = LOWER(?)',
            [Date.now(), username]
        );
        
        // Log the reward removal
        console.log('Invite record removed (user left server)');
        console.log(`Inviter: ${inviter}`);
        console.log(`Coins deducted: ${rewardToDeduct}`);
        console.log('Invite record marked as left (cooldown active)');
        
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
                    deduct_per_invite: config.deduct_per_invite || 0,
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
                    deduct_per_invite: 0,
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

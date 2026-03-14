// Aether Discord Bot - Invite Tracking Bot
// Detects which invite was used when users join the Discord server
// Notifies Aether Dashboard when invites are used

require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const express = require('express');

// Load environment variables from .env file
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || 'http://localhost:3000';
const BOT_API_KEY = process.env.BOT_API_KEY;

// Validate required environment variables
if (!DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN not set in .env');
    process.exit(1);
}

// Print dashboard API URL for debugging
console.log(`Connecting to dashboard: ${DASHBOARD_API_URL}`);

// Global Discord configuration (loaded from dashboard API)
let discordConfig = {
    guild_id: '',
    chat_channel_id: '',
    invite_channel_id: '',
    reward_per_invite: 100,
    enable_chat: true,
    enable_invite_rewards: true
};

// Function to load Discord configuration from dashboard API
async function loadDiscordConfig() {
    try {
        const response = await axios.get(`${DASHBOARD_API_URL}/api/discord/config`, {
            headers: {
                'Authorization': `Bearer ${BOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.success && response.data.config) {
            discordConfig = {
                guild_id: response.data.config.guild_id || '',
                chat_channel_id: response.data.config.chat_channel_id || '',
                invite_channel_id: response.data.config.invite_channel_id || '',
                reward_per_invite: response.data.config.reward_per_invite || 100,
                enable_chat: response.data.config.enable_chat !== false,
                enable_invite_rewards: response.data.config.enable_invite_rewards !== false
            };
            console.log('Discord config loaded from dashboard');
        } else {
            console.warn('Failed to load Discord config: Invalid response format');
        }
    } catch (error) {
        console.error('Failed to load Discord config:', error.message);
        // Fallback to environment variables if config load fails
        if (process.env.DISCORD_CHAT_CHANNEL_ID) {
            discordConfig.chat_channel_id = process.env.DISCORD_CHAT_CHANNEL_ID;
            console.log('Using DISCORD_CHAT_CHANNEL_ID from .env as fallback');
        }
    }
}

// Global Map to store invite usage data
// Key: invite code, Value: number of uses
const inviteCache = new Map();

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Function to fetch and cache all invites for a guild
async function cacheInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        inviteCache.clear(); // Clear existing cache
        
        invites.forEach((invite) => {
            inviteCache.set(invite.code, invite.uses || 0);
        });
        
        console.log(`Cached ${invites.size} invite(s)`);
    } catch (error) {
        console.error('Error fetching invites:', error.message);
    }
}

// Function to send heartbeat to dashboard
async function sendHeartbeat() {
    try {
        await axios.post(
            `${DASHBOARD_API_URL}/api/bot/heartbeat`,
            {},
            {
                headers: {
                    'x-api-key': BOT_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Heartbeat sent to dashboard');
    } catch (error) {
        console.error('Failed to send heartbeat:', error.message);
        // Don't crash the bot if heartbeat fails
    }
}

// Event: Bot is ready and connected to Discord
client.once('ready', async () => {
    console.log('Aether Discord Bot is online');
    
    // Load Discord configuration from dashboard
    await loadDiscordConfig();
    
    // Set up periodic config refresh (every 60 seconds)
    setInterval(loadDiscordConfig, 60000);
    
    // Send initial heartbeat
    await sendHeartbeat();
    
    // Set up periodic heartbeat (every 30 seconds)
    setInterval(sendHeartbeat, 30000);
    
    // Cache invites for all guilds the bot is in
    client.guilds.cache.forEach(async (guild) => {
        await cacheInvites(guild);
    });
});

// Event: Handle when a new member joins the server
client.on('guildMemberAdd', async (member) => {
    // Check if invite rewards are enabled
    if (!discordConfig.enable_invite_rewards) {
        return;
    }
    
    const guild = member.guild;
    const username = member.user.username;
    
    console.log(`User joined: ${username}`);
    
    try {
        // Fetch current invites
        const currentInvites = await guild.invites.fetch();
        
        // Find the invite that was used (usage count increased)
        let usedInvite = null;
        
        for (const [code, invite] of currentInvites) {
            const cachedUses = inviteCache.get(code) || 0;
            const currentUses = invite.uses || 0;
            
            // If current uses is greater than cached uses, this invite was used
            if (currentUses > cachedUses) {
                usedInvite = invite;
                break;
            }
        }
        
        if (usedInvite) {
            // Get inviter username
            const inviterUsername = usedInvite.inviter ? usedInvite.inviter.username : 'Unknown';
            
            console.log(`Invite used: ${usedInvite.code}`);
            console.log(`Invited by: ${inviterUsername}`);
            
            // Send invite event to dashboard
            try {
                const apiUrl = `${DASHBOARD_API_URL}/api/discord/invite-used`;
                const payload = {
                    inviter: inviterUsername,
                    invite_code: usedInvite.code,
                    joined_user: username
                };
                
                await axios.post(apiUrl, payload, {
                    headers: {
                        'Authorization': `Bearer ${BOT_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('Invite reward event sent to dashboard.');
            } catch (error) {
                console.error('Failed to send invite event:', error.message);
                console.log('Failed to send invite event.');
            }
        } else {
            // Edge case: invite could not be determined
            console.log('Invite could not be determined.');
        }
        
        // Update cache with new invite counts
        currentInvites.forEach((invite) => {
            inviteCache.set(invite.code, invite.uses || 0);
        });
        
    } catch (error) {
        console.error('Error detecting invite:', error.message);
        console.log('Invite could not be determined.');
    }
});

// Event: Handle when a member leaves the server
client.on('guildMemberRemove', async (member) => {
    const username = member.user.username;
    
    console.log(`User left server: ${username}`);
    
    // Send leave event to dashboard
    try {
        const apiUrl = `${DASHBOARD_API_URL}/api/discord/member-left`;
        const payload = {
            username: username
        };
        
        await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${BOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Leave event sent to dashboard.');
    } catch (error) {
        console.error('Failed to send leave event:', error.message);
        console.log('Failed to send leave event.');
    }
});

// Event: Handle when a message is created in Discord
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if chat is enabled
    if (!discordConfig.enable_chat) {
        return;
    }
    
    // Only process messages from the configured chat channel
    const chatChannelId = discordConfig.chat_channel_id || process.env.DISCORD_CHAT_CHANNEL_ID;
    if (!chatChannelId || message.channel.id !== chatChannelId) {
        return;
    }
    
    // Log the message
    console.log('Discord message detected');
    console.log(`User: ${message.author.username}`);
    console.log(`Message: ${message.content}`);
    
    // Send message to dashboard
    try {
        await axios.post(
            `${DASHBOARD_API_URL}/api/discord/message`,
            {
                username: message.author.username,
                avatar: message.author.displayAvatarURL(),
                message: message.content,
                timestamp: Date.now()
            },
            {
                headers: {
                    'Authorization': `Bearer ${BOT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('Discord message sent to dashboard.');
    } catch (error) {
        console.error('Failed to send message to dashboard:', error.message);
        console.log('Failed to send message to dashboard.');
    }
});

// Event: Handle errors
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

// Event: Handle disconnection
client.on('disconnect', () => {
    console.log('Bot disconnected from Discord');
});

// Express server for receiving messages from dashboard
const app = express();
app.use(express.json());

// Middleware to verify bot API key authentication
function verifyBotAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.BOT_API_KEY;
    
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Missing Authorization header'
        });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    if (!expectedKey || token !== expectedKey) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid API key'
        });
    }
    
    next();
}

// POST /bot/send-message
// Endpoint for dashboard to send messages to Discord
app.post('/bot/send-message', verifyBotAuth, async (req, res) => {
    try {
        const { username, message } = req.body;
        
        // Validate required fields
        if (!username || !message) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: username, message'
            });
        }
        
        // Check if chat is enabled
        if (!discordConfig.enable_chat) {
            return res.status(400).json({
                success: false,
                message: 'Discord chat is disabled'
            });
        }
        
        // Get the Discord channel
        const channelId = discordConfig.chat_channel_id || process.env.DISCORD_CHAT_CHANNEL_ID;
        if (!channelId) {
            return res.status(500).json({
                success: false,
                message: 'Discord chat channel not configured'
            });
        }
        
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            return res.status(500).json({
                success: false,
                message: 'Discord channel not found'
            });
        }
        
        // Send message to Discord channel
        await channel.send(`**${username}:** ${message}`);
        
        // Return success response
        res.json({
            success: true
        });
        
    } catch (error) {
        console.error('Error sending message to Discord:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Start Express server
const API_PORT = process.env.BOT_API_PORT || 4000;
app.listen(API_PORT, () => {
    console.log(`Bot API running on port ${API_PORT}`);
});

// Login to Discord
client.login(DISCORD_BOT_TOKEN).catch((error) => {
    console.error('Failed to login to Discord:', error.message);
    process.exit(1);
});

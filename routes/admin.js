// Admin Routes
// Admin panel for managing users, servers, and coins

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { db, query, get, run, transaction } = require('../config/database');
const { sanitizeBody } = require('../middleware/validation');
const { sendBrandedView } = require('../config/brandingHelper');
const { writeLog } = require('../utils/auditLog');

// Configure multer for file uploads (configure once, use multiple times)
const uploadPath = path.join(__dirname, '../public/assets/branding');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Keep original extension
        const ext = path.extname(file.originalname);
        if (file.fieldname === 'logo') {
            cb(null, `custom-logo${ext}`);
        } else if (file.fieldname === 'favicon') {
            cb(null, `custom-favicon${ext}`);
        } else {
            cb(null, file.originalname);
        }
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        // Allow images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Multer middleware for branding uploads
const brandingUpload = upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]);

// Template icon upload (SVG only)
const templateIconUploadPath = path.join(__dirname, '../public/icons/template-icons');
const templateIconStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, templateIconUploadPath);
    },
    filename: (req, file, cb) => {
        const safeBase = path.basename(file.originalname, path.extname(file.originalname))
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'template-icon';
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `${safeBase}-${unique}.svg`);
    }
});

const templateIconUpload = multer({
    storage: templateIconStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        const isSvgMime = mime.includes('svg');
        if (ext === '.svg' && (isSvgMime || mime === 'application/octet-stream' || mime === 'text/plain')) {
            cb(null, true);
        } else {
            cb(new Error('Only SVG files are allowed'));
        }
    }
});

// Store resource icon upload (SVG only)
const storeIconUploadPath = path.join(__dirname, '../public/icons/resource-custom');
const storeIconStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, storeIconUploadPath);
    },
    filename: (req, file, cb) => {
        const resourceType = String(req.body?.resource_type || 'resource').toLowerCase().replace(/[^a-z_]/g, '');
        const safeResourceType = ['ram', 'cpu', 'storage', 'server_slot', 'database', 'backup'].includes(resourceType) ? resourceType : 'resource';
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        cb(null, `${safeResourceType}-${unique}.svg`);
    }
});

const storeIconUpload = multer({
    storage: storeIconStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        const isSvgMime = mime.includes('svg');
        if (ext === '.svg' && (isSvgMime || mime === 'application/octet-stream' || mime === 'text/plain')) {
            cb(null, true);
        } else {
            cb(new Error('Only SVG files are allowed'));
        }
    }
});

// Validate URL format
function isValidUrl(url) {
    if (typeof url !== 'string' || url.trim().length === 0) {
        return false;
    }
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidTemplateIcon(iconValue) {
    if (typeof iconValue !== 'string') return false;
    const icon = iconValue.trim();
    if (!icon) return true;
    if (icon.startsWith('/icons/template-icons/')) {
        return /^\/icons\/template-icons\/[a-z0-9._-]+\.svg$/i.test(icon);
    }
    // Backward compatibility for older emoji icons
    return icon.length <= 8;
}

// Middleware to check if user is logged in and is admin
const requireAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    if (!req.session.user.is_admin) {
        return res.status(403).send('Access denied. Admin only.');
    }
    next();
};

// Admin dashboard page
router.get('/', requireAdmin, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/admin.html'));
});

// Admin settings page (redirects to themes)
router.get('/settings', requireAdmin, (req, res) => {
    res.redirect('/admin/settings/themes');
});

// Admin themes page
router.get('/settings/themes', requireAdmin, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/admin-themes.html'));
});

// Admin branding page
router.get('/settings/branding', requireAdmin, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/admin-branding.html'));
});

// Admin integrations - Linkvertise page
router.get('/integrations/linkvertise', requireAdmin, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/admin-integrations-linkvertise.html'));
});

// Admin integrations - Discord page
router.get('/integrations/discord', requireAdmin, (req, res) => {
    sendBrandedView(res, db, path.join(__dirname, '../views/admin-integrations-discord.html'));
});

// API endpoint to get system statistics
router.get('/api/stats', requireAdmin, async (req, res) => {
    try {
        const totalUsers = await get('SELECT COUNT(*) as count FROM users');
        const totalServers = await get('SELECT COUNT(*) as count FROM servers');
        const totalCoins = await get('SELECT SUM(coins) as total FROM users');
        const usersLastWeek = await get(
            "SELECT COUNT(*) as count FROM users WHERE created_at <= datetime('now', '-7 days')"
        );
        const serversLastWeek = await get(
            "SELECT COUNT(*) as count FROM servers WHERE created_at <= datetime('now', '-7 days')"
        );
        
        res.json({
            success: true,
            stats: {
                total_users: totalUsers.count,
                total_servers: totalServers.count,
                total_coins: totalCoins.total || 0,
                users_last_week: usersLastWeek.count,
                servers_last_week: serversLastWeek.count
            }
        });
    } catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching statistics' });
    }
});

// API endpoint to get all users
router.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await query(
            'SELECT id, username, email, coins, is_admin, created_at FROM users ORDER BY created_at DESC'
        );
        
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
});

// API endpoint to update user
router.put('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, email, is_admin } = req.body;
        const { get, run, query } = require('../config/database');
        
        // Validate input
        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: 'Username and email are required'
            });
        }
        
        // Get current user data
        const currentUser = await get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if username is already taken by another user
        const existingUsername = await get(
            'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?',
            [username, userId]
        );
        if (existingUsername) {
            return res.status(400).json({
                success: false,
                message: 'Username is already taken'
            });
        }
        
        // Check if email is already taken by another user
        const existingEmail = await get(
            'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
            [email, userId]
        );
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email is already taken'
            });
        }
        
        // Handle admin status change
        const newIsAdmin = is_admin ? 1 : 0;
        const wasAdmin = currentUser.is_admin === 1;
        const willBeAdmin = newIsAdmin === 1;
        
        // Safety check: Prevent removing admin status if it's the last admin
        if (wasAdmin && !willBeAdmin) {
            const adminCount = await get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
            if (adminCount.count <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot remove admin status: This is the only admin account. At least one admin must exist.'
                });
            }
        }
        
        // Prevent user from removing their own admin status
        if (wasAdmin && !willBeAdmin && parseInt(userId) === req.session.user.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot remove admin status from your own account'
            });
        }
        
        // Update user
        await run(
            'UPDATE users SET username = ?, email = ?, is_admin = ? WHERE id = ?',
            [username, email.toLowerCase(), newIsAdmin, userId]
        );
        
        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user'
        });
    }
});

// API endpoint to delete user
router.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Don't allow deleting yourself
        if (parseInt(userId) === req.session.user.id) {
            return res.status(400).json({ 
                success: false, 
                message: 'You cannot delete your own account' 
            });
        }
        
        // BUGFIX #13: Get user info before deletion (for Pterodactyl cleanup)
        const user = await get('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // BUGFIX #13: Delete user's servers from Pterodactyl first
        const pterodactyl = require('../config/pterodactyl');
        if (await pterodactyl.isConfigured()) {
            // Get all servers owned by this user
            const userServers = await query('SELECT pterodactyl_id FROM servers WHERE user_id = ? AND pterodactyl_id IS NOT NULL', [userId]);
            
            for (const server of userServers) {
                try {
                    await pterodactyl.deleteServer(server.pterodactyl_id);
                    console.log(`Deleted Pterodactyl server ${server.pterodactyl_id} for user ${userId}`);
                } catch (serverError) {
                    console.error(`Error deleting Pterodactyl server ${server.pterodactyl_id}:`, serverError);
                    // Continue with deletion even if server deletion fails
                }
            }
            
            // BUGFIX #13: Delete user from Pterodactyl if they have a pterodactyl_user_id
            if (user.pterodactyl_user_id) {
                try {
                    await pterodactyl.deleteUser(user.pterodactyl_user_id);
                    console.log(`Deleted Pterodactyl user ${user.pterodactyl_user_id} for dashboard user ${userId}`);
                } catch (pterodactylError) {
                    console.error(`Error deleting Pterodactyl user ${user.pterodactyl_user_id}:`, pterodactylError);
                    // Continue with local deletion even if Pterodactyl deletion fails
                }
            }
        }
        
        // Delete user from local database (cascade will delete servers)
        await run('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
});

// API endpoint to get all servers
router.get('/api/servers', requireAdmin, async (req, res) => {
    try {
        const servers = await query(
            `SELECT s.*, u.username 
             FROM servers s 
             LEFT JOIN users u ON s.user_id = u.id 
             ORDER BY s.created_at DESC`
        );
        
        res.json({ success: true, servers });
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ success: false, message: 'Error fetching servers' });
    }
});

// API endpoint to delete server (admin)
router.delete('/api/servers/:id', requireAdmin, async (req, res) => {
    try {
        const serverId = req.params.id;
        
        // Get server info for Pterodactyl deletion if needed
        const server = await get('SELECT * FROM servers WHERE id = ?', [serverId]);
        
        if (server && server.pterodactyl_id) {
            const pterodactyl = require('../config/pterodactyl');
            if (await pterodactyl.isConfigured()) {
                try {
                    await pterodactyl.deleteServer(server.pterodactyl_id);
                } catch (error) {
                    console.error('Error deleting from Pterodactyl:', error);
                }
            }
        }
        
        await run('DELETE FROM servers WHERE id = ?', [serverId]);
        
        res.json({ success: true, message: 'Server deleted successfully' });
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ success: false, message: 'Error deleting server' });
    }
});

// API endpoint to manage coins
router.post('/api/coins', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { username, amount } = req.body;
        
        console.log('Coin update request:', { username, amount, body: req.body });
        
        if (!username || username.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Username is required' 
            });
        }
        
        if (amount === undefined || amount === null || amount === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Amount is required' 
            });
        }
        
        // Parse amount - use parseFloat to handle decimals, then convert to integer
        const amountNum = parseFloat(amount);
        
        if (isNaN(amountNum) || !isFinite(amountNum)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount. Please enter a valid number.' 
            });
        }
        
        // Convert to integer (round to nearest whole number)
        const amountInt = Math.round(amountNum);
        
        // BUGFIX: Use transaction to atomically read and update coins
        // This prevents race conditions when multiple admins update the same user simultaneously
        // or when a user makes purchases while an admin is updating their coins
        let updatedUser = null;
        let oldBalance = null;
        
        await transaction(async () => {
            // Get user by username within transaction (for consistency)
            const user = await get('SELECT id, coins, username FROM users WHERE username = ?', [username.trim()]);
            if (!user) {
                throw new Error(`User "${username}" not found`);
            }
            
            // Store old balance for response message
            oldBalance = user.coins;
            
            // Calculate new balance based on current balance within transaction
            // This ensures we're working with the latest balance, even if user made purchases
            const newBalance = Math.max(0, user.coins + amountInt); // Don't allow negative balance
            
            console.log('Updating coins:', { 
                userId: user.id, 
                username: user.username, 
                oldBalance: oldBalance, 
                amount: amountInt, 
                newBalance 
            });
            
            // Update coins atomically within transaction
            await run('UPDATE users SET coins = ? WHERE id = ?', [newBalance, user.id]);
            
            // Get updated user data within transaction
            updatedUser = await get('SELECT coins, username FROM users WHERE id = ?', [user.id]);
        }).catch((error) => {
            // Transaction failed - return error
            if (!res.headersSent) {
                const statusCode = error.message.includes('not found') ? 404 : 500;
                return res.status(statusCode).json({ 
                    success: false, 
                    message: error.message || 'Error updating coins'
                });
            }
        });
        
        // If transaction failed, we already returned, so exit
        if (res.headersSent || !updatedUser) {
            return;
        }
        
        res.json({ 
            success: true, 
            message: `Coins updated successfully for user "${updatedUser.username}". Balance: ${oldBalance} + ${amountInt >= 0 ? '+' : ''}${amountInt} = ${updatedUser.coins}`,
            new_balance: updatedUser.coins
        });
        writeLog(
            req.session.user.id,
            req.session.user.username,
            'coins_adjusted_admin',
            `Admin adjusted coins for '${updatedUser.username}': ${amountInt >= 0 ? '+' : ''}${amountInt} coins (new balance: ${updatedUser.coins})`
        ).catch(() => {});
    } catch (error) {
        console.error('Error updating coins:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating coins',
            error: error.message 
        });
    }
});

// Linkvertise Configuration API
router.get('/api/linkvertise/config', requireAdmin, async (req, res) => {
    try {
        const config = await get('SELECT * FROM linkvertise_config ORDER BY id DESC LIMIT 1');
        res.json({ success: true, config: config || null });
    } catch (error) {
        console.error('Error fetching Linkvertise config:', error);
        res.status(500).json({ success: false, message: 'Error fetching configuration' });
    }
});

router.post('/api/linkvertise/config', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { publisher_link, publisher_id, default_coins, cooldown_seconds } = req.body;
        
        // Extract publisher ID from link if not provided
        let extractedId = publisher_id;
        if (!extractedId && publisher_link) {
            const match = publisher_link.match(/\/ac\/(\d+)/);
            if (match) {
                extractedId = match[1];
            }
        }
        
        // Validate cooldown_seconds
        const cooldown = (cooldown_seconds !== undefined && cooldown_seconds >= 0) ? cooldown_seconds : 30;
        
        // Check if config exists
        const existing = await get('SELECT id FROM linkvertise_config ORDER BY id DESC LIMIT 1');
        
        if (existing) {
            // Update existing config
            await run(
                'UPDATE linkvertise_config SET publisher_link = ?, publisher_id = ?, default_coins = ?, cooldown_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [publisher_link || '', extractedId || '', default_coins || 10, cooldown, existing.id]
            );
        } else {
            // Create new config
            await run(
                'INSERT INTO linkvertise_config (publisher_link, publisher_id, default_coins, cooldown_seconds) VALUES (?, ?, ?, ?)',
                [publisher_link || '', extractedId || '', default_coins || 10, cooldown]
            );
        }
        
        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
        console.error('Error saving Linkvertise config:', error);
        res.status(500).json({ success: false, message: 'Error saving configuration' });
    }
});

// Discord Configuration API
router.get('/api/discord-config', requireAdmin, async (req, res) => {
    try {
        const config = await get('SELECT * FROM discord_config ORDER BY id DESC LIMIT 1');
        if (config) {
            res.json({ 
                success: true, 
                config: {
                    guild_id: config.guild_id || '',
                    chat_channel_id: config.chat_channel_id || '',
                    invite_channel_id: config.invite_channel_id || '',
                    discord_invite_link: config.discord_invite_link || '',
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
                    discord_invite_link: '',
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

router.post('/api/discord-config', requireAdmin, async (req, res) => {
    try {
        const { guild_id, chat_channel_id, invite_channel_id, discord_invite_link, reward_per_invite, enable_chat, enable_invite_rewards, deduct_per_invite } = req.body;
        
        // Validate reward_per_invite is an integer
        const rewardPerInvite = parseInt(reward_per_invite);
        if (isNaN(rewardPerInvite) || rewardPerInvite < 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reward per invite must be a non-negative integer' 
            });
        }
        const deductPerInvite = Math.max(0, parseInt(deduct_per_invite) || 0);

        let inviteLink = discord_invite_link != null ? String(discord_invite_link).trim() : '';
        if (inviteLink.length > 512) {
            return res.status(400).json({ success: false, message: 'Discord invite link is too long (max 512 characters)' });
        }
        if (inviteLink.length > 0) {
            let parsed;
            try {
                parsed = new URL(inviteLink);
            } catch {
                return res.status(400).json({ success: false, message: 'Discord invite link must be a valid URL (https://…)' });
            }
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return res.status(400).json({ success: false, message: 'Discord invite link must use http or https' });
            }
            const host = (parsed.hostname || '').toLowerCase();
            const allowed = host === 'discord.gg' || host.endsWith('.discord.gg')
                || host === 'discord.com' || host.endsWith('.discord.com')
                || host === 'discordapp.com' || host.endsWith('.discordapp.com');
            if (!allowed) {
                return res.status(400).json({
                    success: false,
                    message: 'Discord invite link must be a discord.gg, discord.com, or discordapp.com URL'
                });
            }
        }
        
        // Convert boolean values to integers for database storage
        const enableChatInt = enable_chat === true || enable_chat === 'true' || enable_chat === 1 ? 1 : 0;
        const enableInviteRewardsInt = enable_invite_rewards === true || enable_invite_rewards === 'true' || enable_invite_rewards === 1 ? 1 : 0;
        
        // Check if config exists
        const existing = await get('SELECT id FROM discord_config ORDER BY id DESC LIMIT 1');
        
        if (existing) {
            // Update existing config
            await run(
                'UPDATE discord_config SET guild_id = ?, chat_channel_id = ?, invite_channel_id = ?, discord_invite_link = ?, reward_per_invite = ?, deduct_per_invite = ?, enable_chat = ?, enable_invite_rewards = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [guild_id || '', chat_channel_id || '', invite_channel_id || '', inviteLink, rewardPerInvite, deductPerInvite, enableChatInt, enableInviteRewardsInt, existing.id]
            );
        } else {
            // Create new config
            await run(
                'INSERT INTO discord_config (guild_id, chat_channel_id, invite_channel_id, discord_invite_link, reward_per_invite, deduct_per_invite, enable_chat, enable_invite_rewards) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [guild_id || '', chat_channel_id || '', invite_channel_id || '', inviteLink, rewardPerInvite, deductPerInvite, enableChatInt, enableInviteRewardsInt]
            );
        }
        
        res.json({ success: true, message: 'Discord configuration saved successfully' });
    } catch (error) {
        console.error('Error saving Discord config:', error);
        res.status(500).json({ success: false, message: 'Error saving configuration' });
    }
});

// Linkvertise Links API
router.get('/api/linkvertise/links', requireAdmin, async (req, res) => {
    try {
        const links = await query('SELECT * FROM linkvertise_links ORDER BY priority DESC, created_at DESC');
        res.json({ success: true, links });
    } catch (error) {
        console.error('Error fetching links:', error);
        res.status(500).json({ success: false, message: 'Error fetching links' });
    }
});

router.get('/api/linkvertise/links/:id', requireAdmin, async (req, res) => {
    try {
        const link = await get('SELECT * FROM linkvertise_links WHERE id = ?', [req.params.id]);
        if (!link) {
            return res.status(404).json({ success: false, message: 'Link not found' });
        }
        res.json({ success: true, link });
    } catch (error) {
        console.error('Error fetching link:', error);
        res.status(500).json({ success: false, message: 'Error fetching link' });
    }
});

router.post('/api/linkvertise/links', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { title, url, coins_earned, is_active, priority, max_completions, completion_window_hours } = req.body;
        const maxCompletions = parseInt(max_completions) || 0;
        const completionWindowHours = parseInt(completion_window_hours) || 24;
        
        if (!title || !url) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and URL are required' 
            });
        }
        
        // Validate title length
        if (title.length > 100) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title must be 100 characters or less' 
            });
        }
        
        // Validate URL format
        if (!isValidUrl(url)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid URL format. URL must start with http:// or https://' 
            });
        }
        
        // Validate coins_earned
        const coins = parseInt(coins_earned) || 10;
        if (coins < 0 || coins > 10000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Coins earned must be between 0 and 10000' 
            });
        }
        
        const result = await run(
            'INSERT INTO linkvertise_links (title, url, coins_earned, is_active, priority, max_completions, completion_window_hours) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title.trim(), url.trim(), coins, is_active !== undefined ? is_active : 1, priority || 0, maxCompletions, completionWindowHours]
        );
        
        res.json({ 
            success: true, 
            message: 'Link added successfully',
            link_id: result.lastID
        });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({ success: false, message: 'Error creating link' });
    }
});

router.put('/api/linkvertise/links/:id', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { title, url, coins_earned, is_active, priority, max_completions, completion_window_hours } = req.body;
        const maxCompletions = parseInt(max_completions) || 0;
        const completionWindowHours = parseInt(completion_window_hours) || 24;
        const linkId = req.params.id;
        
        if (!title || !url) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and URL are required' 
            });
        }
        
        // Validate title length
        if (title.length > 100) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title must be 100 characters or less' 
            });
        }
        
        // Validate URL format
        if (!isValidUrl(url)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid URL format. URL must start with http:// or https://' 
            });
        }
        
        // Validate coins_earned
        const coins = parseInt(coins_earned) || 10;
        if (coins < 0 || coins > 10000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Coins earned must be between 0 and 10000' 
            });
        }
        
        await run(
            'UPDATE linkvertise_links SET title = ?, url = ?, coins_earned = ?, is_active = ?, priority = ?, max_completions = ?, completion_window_hours = ? WHERE id = ?',
            [title.trim(), url.trim(), coins, is_active !== undefined ? is_active : 1, priority || 0, maxCompletions, completionWindowHours, linkId]
        );
        
        res.json({ success: true, message: 'Link updated successfully' });
    } catch (error) {
        console.error('Error updating link:', error);
        res.status(500).json({ success: false, message: 'Error updating link' });
    }
});

router.delete('/api/linkvertise/links/:id', requireAdmin, async (req, res) => {
    try {
        const linkId = req.params.id;
        await run('DELETE FROM linkvertise_links WHERE id = ?', [linkId]);
        res.json({ success: true, message: 'Link deleted successfully' });
    } catch (error) {
        console.error('Error deleting link:', error);
        res.status(500).json({ success: false, message: 'Error deleting link' });
    }
});

// Store Management API
router.get('/api/store/prices', requireAdmin, async (req, res) => {
    try {
        const prices = await get('SELECT * FROM resource_prices ORDER BY id DESC LIMIT 1');
        res.json({ success: true, prices: prices || null });
    } catch (error) {
        console.error('Error fetching store prices:', error);
        res.status(500).json({ success: false, message: 'Error fetching prices' });
    }
});

router.post('/api/store/prices', requireAdmin, async (req, res) => {
    try {
        const { 
            ram_coins_per_set, ram_gb_per_set,
            cpu_coins_per_set, cpu_percent_per_set,
            storage_coins_per_set, storage_gb_per_set,
            server_slot_price,
            database_coins_per_set, database_count_per_set,
            backup_coins_per_set, backup_count_per_set,
            port_coins_per_set, port_count_per_set,
            max_ram_gb, max_cpu_percent, max_storage_gb, max_server_slots,
            max_databases, max_backups, max_ports,
            ram_icon_path, cpu_icon_path, storage_icon_path, server_slot_icon_path,
            database_icon_path, backup_icon_path, port_icon_path
        } = req.body;
        
        // Validate all fields are present
        if (ram_coins_per_set === undefined || ram_gb_per_set === undefined ||
            cpu_coins_per_set === undefined || cpu_percent_per_set === undefined ||
            storage_coins_per_set === undefined || storage_gb_per_set === undefined ||
            server_slot_price === undefined ||
            database_coins_per_set === undefined || database_count_per_set === undefined ||
            backup_coins_per_set === undefined || backup_count_per_set === undefined ||
            port_coins_per_set === undefined || port_count_per_set === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'All price fields are required' 
            });
        }
        
        // Validate values
        if (ram_coins_per_set < 1 || ram_gb_per_set < 1 ||
            cpu_coins_per_set < 1 || cpu_percent_per_set < 1 || cpu_percent_per_set > 100 ||
            storage_coins_per_set < 1 || storage_gb_per_set < 1 ||
            server_slot_price < 1 ||
            database_coins_per_set < 1 || database_count_per_set < 1 ||
            backup_coins_per_set < 1 || backup_count_per_set < 1 ||
            port_coins_per_set < 1 || port_count_per_set < 1) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid price values. All values must be at least 1, and CPU % must be between 1 and 100.' 
            });
        }

        // Parse limits — default to 0 (unlimited) if not provided or invalid
        const parsedMaxRamGb = Math.max(0, parseInt(max_ram_gb) || 0);
        const parsedMaxCpuPercent = Math.max(0, parseInt(max_cpu_percent) || 0);
        const parsedMaxStorageGb = Math.max(0, parseInt(max_storage_gb) || 0);
        const parsedMaxSlots = Math.max(0, parseInt(max_server_slots) || 0);
        const parsedMaxDatabases = Math.max(0, parseInt(max_databases) || 0);
        const parsedMaxBackups = Math.max(0, parseInt(max_backups) || 0);
        const parsedMaxPorts = Math.max(0, parseInt(max_ports) || 0);
        const parsedRamIconPath = (typeof ram_icon_path === 'string' && ram_icon_path.trim()) ? ram_icon_path.trim() : '/icons/ram.svg';
        const parsedCpuIconPath = (typeof cpu_icon_path === 'string' && cpu_icon_path.trim()) ? cpu_icon_path.trim() : '/icons/cpu.svg';
        const parsedStorageIconPath = (typeof storage_icon_path === 'string' && storage_icon_path.trim()) ? storage_icon_path.trim() : '/icons/storage.svg';
        const parsedServerSlotIconPath = (typeof server_slot_icon_path === 'string' && server_slot_icon_path.trim()) ? server_slot_icon_path.trim() : '/icons/server-slot.svg';
        const parsedDatabaseIconPath = (typeof database_icon_path === 'string' && database_icon_path.trim()) ? database_icon_path.trim() : '/icons/database.svg';
        const parsedBackupIconPath = (typeof backup_icon_path === 'string' && backup_icon_path.trim()) ? backup_icon_path.trim() : '/icons/backup.svg';
        const parsedPortIconPath = (typeof port_icon_path === 'string' && port_icon_path.trim()) ? port_icon_path.trim() : '/icons/ip.svg';
        
        // Check if prices exist
        const existing = await get('SELECT id FROM resource_prices ORDER BY id DESC LIMIT 1');
        
        if (existing) {
            // Update existing prices
            await run(
                `UPDATE resource_prices 
                 SET ram_coins_per_set = ?, ram_gb_per_set = ?,
                     cpu_coins_per_set = ?, cpu_percent_per_set = ?,
                     storage_coins_per_set = ?, storage_gb_per_set = ?,
                     server_slot_price = ?,
                     database_coins_per_set = ?, database_count_per_set = ?,
                     backup_coins_per_set = ?, backup_count_per_set = ?,
                     port_coins_per_set = ?, port_count_per_set = ?,
                     max_ram_gb = ?, max_cpu_percent = ?,
                     max_storage_gb = ?, max_server_slots = ?, max_databases = ?, max_backups = ?, max_ports = ?,
                     ram_icon_path = ?, cpu_icon_path = ?,
                     storage_icon_path = ?, server_slot_icon_path = ?, database_icon_path = ?, backup_icon_path = ?, port_icon_path = ?,
                     updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [ram_coins_per_set, ram_gb_per_set,
                 cpu_coins_per_set, cpu_percent_per_set,
                 storage_coins_per_set, storage_gb_per_set,
                 server_slot_price,
                 database_coins_per_set, database_count_per_set,
                 backup_coins_per_set, backup_count_per_set,
                 port_coins_per_set, port_count_per_set,
                 parsedMaxRamGb, parsedMaxCpuPercent,
                 parsedMaxStorageGb, parsedMaxSlots, parsedMaxDatabases, parsedMaxBackups, parsedMaxPorts,
                 parsedRamIconPath, parsedCpuIconPath,
                 parsedStorageIconPath, parsedServerSlotIconPath, parsedDatabaseIconPath, parsedBackupIconPath, parsedPortIconPath,
                 existing.id]
            );
        } else {
            // Create new prices
            await run(
                `INSERT INTO resource_prices 
                 (ram_coins_per_set, ram_gb_per_set, cpu_coins_per_set, cpu_percent_per_set, storage_coins_per_set, storage_gb_per_set, server_slot_price, database_coins_per_set, database_count_per_set, backup_coins_per_set, backup_count_per_set, port_coins_per_set, port_count_per_set, max_ram_gb, max_cpu_percent, max_storage_gb, max_server_slots, max_databases, max_backups, max_ports, ram_icon_path, cpu_icon_path, storage_icon_path, server_slot_icon_path, database_icon_path, backup_icon_path, port_icon_path) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ram_coins_per_set, ram_gb_per_set,
                 cpu_coins_per_set, cpu_percent_per_set,
                 storage_coins_per_set, storage_gb_per_set,
                 server_slot_price,
                 database_coins_per_set, database_count_per_set,
                 backup_coins_per_set, backup_count_per_set,
                 port_coins_per_set, port_count_per_set,
                 parsedMaxRamGb, parsedMaxCpuPercent,
                 parsedMaxStorageGb, parsedMaxSlots, parsedMaxDatabases, parsedMaxBackups, parsedMaxPorts,
                 parsedRamIconPath, parsedCpuIconPath,
                 parsedStorageIconPath, parsedServerSlotIconPath, parsedDatabaseIconPath, parsedBackupIconPath, parsedPortIconPath]
            );
        }
        
        res.json({ success: true, message: 'Prices updated successfully' });
    } catch (error) {
        console.error('Error saving store prices:', error);
        res.status(500).json({ success: false, message: 'Error saving prices' });
    }
});

router.post('/api/store/resource-icon-upload', requireAdmin, (req, res, next) => {
    fs.mkdir(storeIconUploadPath, { recursive: true })
        .then(() => {
            storeIconUpload.single('icon')(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ success: false, message: err.message });
                }
                next();
            });
        })
        .catch((error) => {
            console.error('Error creating resource icon upload directory:', error);
            res.status(500).json({ success: false, message: 'Error setting up resource icon upload directory' });
        });
}, async (req, res) => {
    try {
        const resourceType = String(req.body?.resource_type || '').toLowerCase();
        if (!['ram', 'cpu', 'storage', 'server_slot', 'database', 'backup', 'port'].includes(resourceType)) {
            return res.status(400).json({ success: false, message: 'Invalid resource type' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'SVG file is required' });
        }
        const iconPath = `/icons/resource-custom/${req.file.filename}`;
        res.json({ success: true, icon_path: iconPath });
    } catch (error) {
        console.error('Error uploading resource icon:', error);
        res.status(500).json({ success: false, message: 'Error uploading resource icon' });
    }
});

// Pterodactyl Panel Configuration API
router.get('/api/panel/config', requireAdmin, async (req, res) => {
    try {
        const { get } = require('../config/database');
        const { decrypt } = require('../config/encryption');
        
        const config = await get('SELECT panel_url, api_key, client_api_key, last_connected_at FROM pterodactyl_config ORDER BY id DESC LIMIT 1');
        
        if (config && config.panel_url && config.api_key) {
            // Decrypt API key for display
            const decryptedKey = decrypt(config.api_key);
            res.json({ 
                success: true, 
                config: {
                    panel_url: config.panel_url,
                    api_key: decryptedKey,
                    client_api_key: config.client_api_key || process.env.PTERODACTYL_CLIENT_API_KEY || '',
                    last_connected_at: config.last_connected_at
                }
            });
        } else {
            // Return .env values as fallback
            res.json({ 
                success: true, 
                config: {
                    panel_url: process.env.PTERODACTYL_URL || '',
                    api_key: process.env.PTERODACTYL_API_KEY || '',
                    client_api_key: process.env.PTERODACTYL_CLIENT_API_KEY || '',
                    last_connected_at: null
                }
            });
        }
    } catch (error) {
        console.error('Error fetching panel config:', error);
        res.status(500).json({ success: false, message: 'Error fetching configuration' });
    }
});

router.post('/api/panel/test', requireAdmin, async (req, res) => {
    try {
        const { panel_url, api_key, client_api_key } = req.body;
        
        if (!panel_url || !api_key || !client_api_key) {
            return res.status(400).json({ 
                success: false, 
                message: 'Panel URL, application API key, and client API key are required' 
            });
        }
        
        // Validate URL format
        try {
            new URL(panel_url);
        } catch (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid panel URL format' 
            });
        }
        
        // Test connection for application API key
        const { testConnection } = require('../config/pterodactyl');
        const result = await testConnection(panel_url, api_key);
        
        if (!result.success) {
            return res.json(result);
        }

        // Test client API key by calling /client/account
        const axios = require('axios');
        try {
            const clientTest = await axios.get(`${panel_url.replace(/\/+$/,'')}/api/client/account`, {
                headers: {
                    'Authorization': `Bearer ${client_api_key}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            if (clientTest.status !== 200) {
                return res.json({
                    success: false,
                    message: 'Application API key is valid, but Client API key test failed.'
                });
            }
        } catch (e) {
            return res.json({
                success: false,
                message: 'Application API key is valid, but Client API key test failed: ' + (e.response?.data?.message || e.message)
            });
        }
        
        res.json({ success: true, message: 'Connection successful! Both application and client API keys are valid.' });
    } catch (error) {
        console.error('Error testing panel connection:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error testing connection' 
        });
    }
});

router.post('/api/panel/connect', requireAdmin, async (req, res) => {
    try {
        const { panel_url, api_key, client_api_key } = req.body;
        
        if (!panel_url || !api_key || !client_api_key) {
            return res.status(400).json({ 
                success: false, 
                message: 'Panel URL, application API key, and client API key are required' 
            });
        }
        
        // Validate URL format
        try {
            new URL(panel_url);
        } catch (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid panel URL format' 
            });
        }
        
        // Check if there's already an active connection
        const { get, run } = require('../config/database');
        const existing = await get('SELECT id, panel_url, last_connected_at FROM pterodactyl_config ORDER BY id DESC LIMIT 1');
        
        if (existing && existing.last_connected_at) {
            // Check if trying to connect a different panel
            if (existing.panel_url && existing.panel_url.trim() !== panel_url.trim()) {
                return res.status(400).json({ 
                    success: false, 
                    message: `A connection to "${existing.panel_url}" is already active. Please disconnect the current connection before connecting to a different panel.` 
                });
            }
            // If same panel URL, allow reconnection (update)
        }
        
        // Test connection first
        const { testConnection } = require('../config/pterodactyl');
        const testResult = await testConnection(panel_url, api_key);
        
        if (!testResult.success) {
            return res.status(400).json({ 
                success: false, 
                message: testResult.message || 'Connection test failed. Please verify your credentials.' 
            });
        }
        
        // Encrypt API key before storing
        const { encrypt } = require('../config/encryption');
        const encryptedKey = encrypt(api_key);
        
        if (!encryptedKey) {
            return res.status(500).json({ 
                success: false, 
                message: 'Error encrypting API key' 
            });
        }
        
        const now = new Date().toISOString();
        
        if (existing) {
            // Update existing config
            await run(
                'UPDATE pterodactyl_config SET panel_url = ?, api_key = ?, client_api_key = ?, last_connected_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [panel_url, encryptedKey, client_api_key, now, existing.id]
            );
        } else {
            // Create new config
            await run(
                'INSERT INTO pterodactyl_config (panel_url, api_key, client_api_key, last_connected_at) VALUES (?, ?, ?, ?)',
                [panel_url, encryptedKey, client_api_key, now]
            );
        }
        
        // Clear config cache to force reload
        const { clearConfigCache } = require('../config/pterodactyl');
        clearConfigCache();
        
        res.json({ 
            success: true, 
            message: 'Panel configuration saved and connected successfully!',
            last_connected_at: now
        });
    } catch (error) {
        console.error('Error saving panel config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error saving configuration' 
        });
    }
});

// Sync existing dashboard users to Pterodactyl
router.post('/api/panel/sync-users', requireAdmin, async (req, res) => {
    try {
        const pterodactyl = require('../config/pterodactyl');
        const isConfigured = await pterodactyl.isConfigured();
        
        if (!isConfigured) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured. Please configure it first.' 
            });
        }
        
        // Find all users without pterodactyl_user_id
        const { query, get, run } = require('../config/database');
        const usersToSync = await query(`
            SELECT id, username, email, password, discord_id 
            FROM users 
            WHERE pterodactyl_user_id IS NULL OR pterodactyl_user_id = ''
        `);
        
        if (usersToSync.length === 0) {
            return res.json({ 
                success: true, 
                message: 'All users are already synced to Pterodactyl',
                synced: 0,
                failed: 0,
                results: []
            });
        }
        
        const results = [];
        let synced = 0;
        let failed = 0;
        
        for (const user of usersToSync) {
            try {
                // Check if user already exists in Pterodactyl by email
                const existingUser = await pterodactyl.getPterodactylUserByEmail(user.email);
                
                let pterodactylUserId = null;
                
                if (existingUser.success) {
                    // User exists in Pterodactyl, link them
                    pterodactylUserId = existingUser.data.id || existingUser.data.attributes?.id;
                    results.push({
                        username: user.username,
                        email: user.email,
                        status: 'linked',
                        message: 'User already exists in Pterodactyl, linked successfully'
                    });
                } else {
                    // User doesn't exist, create them
                    const names = user.username.split(' ');
                    const firstName = names[0] || user.username;
                    const lastName = names.slice(1).join(' ') || 'User';
                    
                    // Generate a random password for Discord users or users without passwords
                    let password = user.password;
                    if (!password || password === '') {
                        // Generate a secure random password
                        password = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
                    }
                    
                    // For users with hashed passwords, we can't use them directly
                    // Pterodactyl needs plain text password, so we'll generate a new one
                    // The user will need to reset it in Pterodactyl
                    if (password.length > 20 || password.startsWith('$2')) {
                        // Likely a bcrypt hash, generate new password
                        password = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
                    }
                    
                    const pterodactylUser = await pterodactyl.createPterodactylUser({
                        email: user.email,
                        username: user.username,
                        first_name: firstName,
                        last_name: lastName,
                        password: password
                    });
                    
                    if (pterodactylUser.success && pterodactylUser.data) {
                        pterodactylUserId = pterodactylUser.data.id || pterodactylUser.data.attributes?.id;
                        results.push({
                            username: user.username,
                            email: user.email,
                            status: 'created',
                            message: 'User created in Pterodactyl successfully'
                        });
                    } else {
                        throw new Error(pterodactylUser.error || pterodactylUser.message || 'Failed to create user');
                    }
                }
                
                // Update user with Pterodactyl user ID
                if (pterodactylUserId) {
                    await run('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', 
                        [pterodactylUserId, user.id]);
                    synced++;
                }
            } catch (error) {
                console.error(`Error syncing user ${user.username} (${user.email}):`, error);
                failed++;
                results.push({
                    username: user.username,
                    email: user.email,
                    status: 'failed',
                    message: error.message || 'Failed to sync user'
                });
            }
        }
        
        res.json({ 
            success: true, 
            message: `Sync completed: ${synced} users synced, ${failed} failed`,
            synced: synced,
            failed: failed,
            total: usersToSync.length,
            results: results
        });
    } catch (error) {
        console.error('Error syncing users:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error syncing users' 
        });
    }
});

// Import users FROM Pterodactyl panel TO dashboard (with SSE progress)
router.get('/api/panel/import-users', requireAdmin, async (req, res) => {
    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Helper function to send SSE messages
    const sendProgress = (percent, message, status = 'progress') => {
        try {
            const sseData = `data: ${JSON.stringify({ percent, message, status })}\n\n`;
            console.log('[DEBUG] Sending SSE:', { percent, status, message: message.substring(0, 50) });
            res.write(sseData);
        } catch (writeError) {
            console.error('[DEBUG] Error writing SSE data:', writeError);
            console.error('[DEBUG] Write error details:', { message: writeError.message, code: writeError.code });
        }
    };
    
    // Handle client disconnect
    req.on('close', () => {
        console.log('[Import Users] Client disconnected');
        if (!res.headersSent) {
            res.end();
        }
    });
    
    try {
        const pterodactyl = require('../config/pterodactyl');
        const { get, run, query } = require('../config/database');
        const bcrypt = require('bcrypt');
        
        // Check if Pterodactyl is configured
        const isConfigured = await pterodactyl.isConfigured();
        if (!isConfigured) {
            sendProgress(0, 'Pterodactyl panel is not configured', 'error');
            return res.end();
        }
        
        console.log('[DEBUG] Sending initial progress message');
        sendProgress(5, 'Fetching users from Pterodactyl panel...');
        
        // Fetch all users from Pterodactyl with pagination
        let pterodactylUsers;
        try {
            console.log('[DEBUG] Calling getAllUsersPaginated()');
            pterodactylUsers = await pterodactyl.getAllUsersPaginated();
            console.log('[DEBUG] getAllUsersPaginated() returned:', pterodactylUsers?.length || 0, 'users');
        } catch (fetchError) {
            console.error('[DEBUG] Error fetching users:', fetchError);
            console.error('[DEBUG] Error stack:', fetchError.stack);
            sendProgress(0, `Failed to fetch users: ${fetchError.message}`, 'error');
            return res.end();
        }
        
        if (!pterodactylUsers || pterodactylUsers.length === 0) {
            sendProgress(100, 'No users found in Pterodactyl panel', 'complete');
            return res.end();
        }
        
        sendProgress(10, `Found ${pterodactylUsers.length} users in Pterodactyl panel`);
        
        const totalUsers = pterodactylUsers.length;
        let imported = 0;
        let linked = 0;
        let skipped = 0;
        let failed = 0;
        
        // Process each user
        for (let i = 0; i < pterodactylUsers.length; i++) {
            // Check if client disconnected
            if (req.closed || req.destroyed) {
                console.log('[Import Users] Request closed by client');
                return res.end();
            }
            
            // Extract user data - handle both direct and attributes structure
            const userObj = pterodactylUsers[i];
            const pteroUser = userObj.attributes || userObj;
            const percent = Math.round(10 + ((i + 1) / totalUsers) * 85); // Progress from 10% to 95%
            
            // Validate user data
            if (!pteroUser || !pteroUser.email) {
                failed++;
                sendProgress(percent, `Skipped: Invalid user data (missing email)`);
                continue;
            }
            
            try {
                // Check if user already exists in dashboard by email
                const existingUser = await get(
                    'SELECT id, pterodactyl_user_id, username FROM users WHERE LOWER(email) = LOWER(?)',
                    [pteroUser.email]
                );
                
                // Get Pterodactyl user ID (can be in id or attributes.id)
                const pterodactylUserId = userObj.id || pteroUser.id;
                
                if (!pterodactylUserId) {
                    failed++;
                    sendProgress(percent, `Failed: ${pteroUser.email} - Missing Pterodactyl user ID`);
                    continue;
                }
                
                if (existingUser) {
                    // User exists in dashboard
                    if (existingUser.pterodactyl_user_id) {
                        // Already linked - skip
                        skipped++;
                        sendProgress(percent, `Skipped: ${pteroUser.email} (already linked)`);
                    } else {
                        // Link existing user to Pterodactyl
                        await run(
                            'UPDATE users SET pterodactyl_user_id = ? WHERE id = ?',
                            [pterodactylUserId, existingUser.id]
                        );
                        linked++;
                        sendProgress(percent, `Linked: ${pteroUser.email} to existing dashboard user`);
                    }
                } else {
                    // Create new dashboard user
                    // Generate a secure random password (user can reset via Discord OAuth or admin)
                    const randomPassword = require('crypto').randomBytes(16).toString('hex');
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    
                    // Use Pterodactyl username or first_name as dashboard username
                    let username = pteroUser.username || pteroUser.first_name || pteroUser.email.split('@')[0];
                    
                    // Sanitize username (remove special characters, limit length)
                    username = username.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30);
                    if (!username) {
                        username = `user_${pterodactylUserId}`;
                    }
                    
                    // Ensure username is unique
                    const existingUsername = await get(
                        'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
                        [username]
                    );
                    if (existingUsername) {
                        // Append Pterodactyl user ID to make unique
                        username = `${username}_${pterodactylUserId}`.substring(0, 50);
                    }
                    
                    // Insert new user
                    await run(
                        `INSERT INTO users (username, email, password, pterodactyl_user_id, is_admin, coins, 
                         purchased_ram, purchased_cpu, purchased_storage, server_slots, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                        [
                            username,
                            pteroUser.email,
                            hashedPassword,
                            pterodactylUserId,
                            pteroUser.root_admin ? 1 : 0, // Map Pterodactyl admin to dashboard admin
                            0, // Starting coins
                            0, // Starting RAM
                            0, // Starting CPU
                            0, // Starting Storage
                            1  // Starting server slots (default is 1)
                        ]
                    );
                    imported++;
                    sendProgress(percent, `Imported: ${pteroUser.email} as new user`);
                }
            } catch (userError) {
                console.error(`Error processing user ${pteroUser.email}:`, userError);
                failed++;
                const errorMsg = userError.message || 'Unknown error';
                sendProgress(percent, `Failed: ${pteroUser.email} - ${errorMsg}`);
            }
        }
        
        // Send completion message
        const summary = `Migration complete: ${imported} imported, ${linked} linked, ${skipped} skipped, ${failed} failed`;
        sendProgress(100, summary, 'complete');
        
        // Also log to console
        console.log(`[Import Users] ${summary}`);
        
    } catch (error) {
        console.error('Error importing users from Pterodactyl:', error);
        const errorMsg = error.message || 'Unknown error occurred';
        sendProgress(0, `Error: ${errorMsg}`, 'error');
    } finally {
        if (!res.headersSent || !res.closed) {
            res.end();
        }
    }
});

// Disconnect Pterodactyl panel - removes all Pterodactyl-related data
router.post('/api/panel/disconnect', requireAdmin, async (req, res) => {
    try {
        const { run, query } = require('../config/database');
        const { removeAdmins = false } = req.body; // Get option from request body
        
        // BUGFIX #14: Count servers to be deleted (for informational message)
        // We do NOT need to "return resources" because:
        // - purchased_ram/cpu/storage stores TOTAL purchased resources
        // - "used" resources are calculated dynamically from the servers table
        // - When we delete servers, the "used" count automatically decreases
        // - Available = Purchased - Used, so available automatically increases
        // The old code was DOUBLING resources by adding them back to purchased_*
        const serversToDelete = await query(
            'SELECT id FROM servers WHERE pterodactyl_id IS NOT NULL'
        );

        // VALIDATION: Check user removal requirements BEFORE deleting config
        // This prevents the panel from appearing disconnected if validation fails
        if (removeAdmins) {
            // User chose to remove ALL imported users (including admins)
            // Safety check: Ensure at least one non-imported admin exists
            const nonImportedAdmins = await query('SELECT id FROM users WHERE is_admin = 1 AND pterodactyl_user_id IS NULL');
            
            if (nonImportedAdmins.length === 0) {
                // No non-imported admins exist - prevent lockout
                // DON'T delete config if validation fails
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cannot remove all imported admins: No non-imported admin accounts exist. This would cause a lockout. Please keep at least one admin account or create a non-imported admin first.' 
                });
            }
        }
        
        // Only proceed with deletion if validation passed
        // Delete all Pterodactyl-related configuration and cached data
        await run('DELETE FROM pterodactyl_config');
        await run('DELETE FROM pterodactyl_eggs');
        await run('DELETE FROM pterodactyl_allocations');
        await run('DELETE FROM pterodactyl_settings');
        
        // Delete all servers that were created through Pterodactyl
        // Resources are automatically "returned" because used resources are calculated dynamically
        await run('DELETE FROM servers WHERE pterodactyl_id IS NOT NULL');

        // Clean up Pterodactyl-linked users based on user's choice
        if (removeAdmins) {
            // Safe to delete all imported users (including admins) - validation already passed
            await run('DELETE FROM users WHERE pterodactyl_user_id IS NOT NULL');
        } else {
            // Default behavior: Remove only non-admin imported users, keep imported admins
            // Strategy:
            // - Preserve at least one admin account to avoid lockout.
            // - Delete users that were imported from Pterodactyl (have a pterodactyl_user_id),
            //   but keep imported admins if all admins are imported.
            const adminUsers = await query('SELECT id, pterodactyl_user_id FROM users WHERE is_admin = 1');
            const nonImportedAdmins = adminUsers.filter(u => !u.pterodactyl_user_id);

            if (nonImportedAdmins.length === 0) {
                // All admins are imported from Pterodactyl – to avoid lockout, keep them but clear linkage
                await run('UPDATE users SET pterodactyl_user_id = NULL, client_api_key = NULL WHERE is_admin = 1');
                // Still remove non-admin imported users
                await run('DELETE FROM users WHERE is_admin = 0 AND pterodactyl_user_id IS NOT NULL');
            } else {
                // We have at least one non-imported admin; safe to delete all imported users (including admins)
                await run('DELETE FROM users WHERE pterodactyl_user_id IS NOT NULL');
            }
        }
        
        // Clear the config cache in pterodactyl module
        const pterodactyl = require('../config/pterodactyl');
        pterodactyl.clearConfigCache();
        
        const deletedCount = serversToDelete.length;
        const userMessage = removeAdmins 
            ? `Pterodactyl panel disconnected successfully. ${deletedCount} server(s) deleted. All imported users (including admins) have been removed.`
            : `Pterodactyl panel disconnected successfully. ${deletedCount} server(s) deleted. Imported users removed (admins kept to prevent lockout).`;
        
        res.json({ 
            success: true, 
            message: userMessage
        });
    } catch (error) {
        console.error('Error disconnecting panel:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error disconnecting panel' 
        });
    }
});

// Pterodactyl Eggs Management API
router.get('/api/panel/eggs', requireAdmin, async (req, res) => {
    try {
        const pterodactyl = require('../config/pterodactyl');
        const isConfigured = await pterodactyl.isConfigured();
        
        if (!isConfigured) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured. Please configure it first.' 
            });
        }
        
        // Fetch eggs from Pterodactyl
        const eggsResult = await pterodactyl.getAllEggs();
        
        if (!eggsResult.success) {
            return res.status(500).json({ 
                success: false, 
                message: eggsResult.error || 'Failed to fetch eggs from Pterodactyl' 
            });
        }
        
        res.json({ 
            success: true, 
            eggs: eggsResult.data || [] 
        });
    } catch (error) {
        console.error('Error fetching eggs:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching eggs' 
        });
    }
});

router.post('/api/panel/eggs/sync', requireAdmin, async (req, res) => {
    try {
        const { egg_ids, eggs } = req.body;
        
        if (!egg_ids || !Array.isArray(egg_ids) || egg_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please select at least one egg to sync' 
            });
        }
        
        if (!eggs || !Array.isArray(eggs)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Egg data is required' 
            });
        }
        
        const pterodactyl = require('../config/pterodactyl');
        const isConfigured = await pterodactyl.isConfigured();
        
        if (!isConfigured) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured. Please configure it first.' 
            });
        }
        
        let synced = 0;
        const errors = [];
        
        // BUGFIX #7: Ensure egg_ids are all integers for consistent comparison
        const normalizedEggIds = egg_ids.map(id => parseInt(id, 10));
        
        // Track identity keys to avoid processing duplicate entries in one sync batch.
        const processedIdentityKeys = new Set();

        // Sync only selected eggs to database
        for (const egg of eggs) {
            // BUGFIX #7: Parse eggId as integer to avoid type mismatch with includes()
            const eggId = parseInt(egg.id || egg.egg_id || egg.attributes?.id, 10);
            
            // Verify this egg is in the selected list (both are now integers)
            if (!normalizedEggIds.includes(eggId)) {
                continue;
            }
            
            try {
                if (Number.isNaN(eggId)) {
                    errors.push('Skipping egg with invalid ID');
                    continue;
                }

                const nestId = parseInt(egg.nest_id || egg.attributes?.nest_id, 10);
                const eggName = (egg.name || egg.attributes?.name || '').trim();
                const dockerImage = egg.docker_image || egg.attributes?.docker_image;
                const startupCommand = egg.startup || egg.startup_command || egg.attributes?.startup || '';

                if (Number.isNaN(nestId) || !eggName) {
                    errors.push(`Skipping egg ${eggId}: missing nest_id or name`);
                    continue;
                }

                const identityKey = `${nestId}:${eggName.toLowerCase()}`;
                if (processedIdentityKeys.has(identityKey)) {
                    continue;
                }
                processedIdentityKeys.add(identityKey);

                // Extract environment variables as JSON string
                const envVars = egg.relationships?.variables?.data || egg.environment_variables || [];
                const envVarsJson = typeof envVars === 'string' ? envVars : JSON.stringify(envVars);

                // First preference: exact egg_id match (normal update path)
                const existingById = await get(
                    `SELECT id, egg_id FROM pterodactyl_eggs WHERE egg_id = ? LIMIT 1`,
                    [eggId]
                );

                if (existingById) {
                    await run(
                        `UPDATE pterodactyl_eggs
                         SET nest_id = ?, name = ?, docker_image = ?, startup_command = ?, environment_variables = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
                         WHERE egg_id = ?`,
                        [nestId, eggName, dockerImage, startupCommand, envVarsJson, eggId]
                    );
                } else {
                    // If egg id changed in panel, match by stable identity (nest + name) and update row to new ID.
                    const existingByIdentity = await get(
                        `SELECT id, egg_id FROM pterodactyl_eggs
                         WHERE nest_id = ? AND LOWER(name) = LOWER(?)
                         ORDER BY updated_at DESC, id DESC
                         LIMIT 1`,
                        [nestId, eggName]
                    );

                    if (existingByIdentity) {
                        await run(
                            `UPDATE pterodactyl_eggs
                             SET egg_id = ?, nest_id = ?, name = ?, docker_image = ?, startup_command = ?, environment_variables = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [eggId, nestId, eggName, dockerImage, startupCommand, envVarsJson, existingByIdentity.id]
                        );
                    } else {
                        await run(
                            `INSERT INTO pterodactyl_eggs
                             (egg_id, nest_id, name, docker_image, startup_command, environment_variables, is_active, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
                            [eggId, nestId, eggName, dockerImage, startupCommand, envVarsJson]
                        );
                    }
                }

                // Safety cleanup: keep only one active row per logical egg identity.
                await run(
                    `UPDATE pterodactyl_eggs
                     SET is_active = 0
                     WHERE nest_id = ? AND LOWER(name) = LOWER(?) AND egg_id != ?`,
                    [nestId, eggName, eggId]
                );

                synced++;
            } catch (error) {
                console.error(`Error syncing egg ${eggId}:`, error);
                errors.push(`Failed to sync egg ${eggId}: ${error.message}`);
            }
        }
        
        if (synced === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No eggs were synced. Please check your selection.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: `Successfully synced ${synced} egg(s)`,
            synced: synced,
            total: egg_ids.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error syncing eggs:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error syncing eggs' 
        });
    }
});

router.get('/api/panel/eggs/cached', requireAdmin, async (req, res) => {
    try {
        const eggs = await query('SELECT * FROM pterodactyl_eggs WHERE is_active = 1 ORDER BY name');
        res.json({ success: true, eggs });
    } catch (error) {
        console.error('Error fetching cached eggs:', error);
        res.status(500).json({ success: false, message: 'Error fetching cached eggs' });
    }
});

// Pterodactyl Allocations Management API
router.get('/api/panel/allocations', requireAdmin, async (req, res) => {
    try {
        const pterodactyl = require('../config/pterodactyl');
        const isConfigured = await pterodactyl.isConfigured();
        
        if (!isConfigured) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured. Please configure it first.' 
            });
        }
        
        // Fetch allocations from Pterodactyl
        const allocationsResult = await pterodactyl.getAllAllocations();
        
        if (!allocationsResult.success) {
            return res.status(500).json({ 
                success: false, 
                message: allocationsResult.error || 'Failed to fetch allocations from Pterodactyl' 
            });
        }
        
        res.json({ 
            success: true, 
            allocations: allocationsResult.data || [] 
        });
    } catch (error) {
        console.error('Error fetching allocations:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching allocations' 
        });
    }
});

router.post('/api/panel/allocations/sync', requireAdmin, async (req, res) => {
    try {
        const pterodactyl = require('../config/pterodactyl');
        const isConfigured = await pterodactyl.isConfigured();
        
        if (!isConfigured) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pterodactyl panel is not configured. Please configure it first.' 
            });
        }
        
        // Fetch allocations from Pterodactyl
        const allocationsResult = await pterodactyl.getAllAllocations();
        
        if (!allocationsResult.success) {
            return res.status(500).json({ 
                success: false, 
                message: allocationsResult.error || 'Failed to fetch allocations from Pterodactyl' 
            });
        }
        
        const allocations = allocationsResult.data || [];
        let synced = 0;
        let removed = 0;
        
        // BUGFIX #2: Clear all existing allocations first, then re-add only unassigned ones
        // This ensures allocations that have been assigned to servers are removed from the pool
        try {
            const existingCount = await get('SELECT COUNT(*) as count FROM pterodactyl_allocations');
            removed = existingCount?.count || 0;
            await run('DELETE FROM pterodactyl_allocations');
        } catch (error) {
            console.error('Error clearing existing allocations:', error);
        }
        
        // Sync allocations to database (only unassigned ones come from getAllAllocations)
        console.log(`[DEBUG] Syncing ${allocations.length} allocations to database...`);
        for (const allocation of allocations) {
            try {
                const allocAttrs = allocation.attributes || allocation;
                const allocationId = allocAttrs.id || allocation.id;
                const nodeId = allocation.node_id || allocAttrs.node_id;

                // Resolve ip_alias: prefer Pterodactyl's own value, then fall back to node default alias
                let resolvedAlias = allocAttrs.ip_alias && String(allocAttrs.ip_alias).trim() !== ''
                    ? String(allocAttrs.ip_alias).trim()
                    : null;

                if (!resolvedAlias && nodeId) {
                    try {
                        const nodeAlias = await get(
                            'SELECT default_alias FROM pterodactyl_node_aliases WHERE node_id = ?',
                            [nodeId]
                        );
                        if (nodeAlias && nodeAlias.default_alias) {
                            resolvedAlias = nodeAlias.default_alias;
                        }
                    } catch (e) {
                        // Table may not exist yet on first sync — safe to ignore
                    }
                }

                console.log(`[DEBUG] Syncing allocation:`, { allocationId, ip: allocAttrs.ip, port: allocAttrs.port, nodeId, resolvedAlias });
                
                await run(`
                    INSERT INTO pterodactyl_allocations 
                    (allocation_id, ip, ip_alias, port, node_id, priority, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP)
                `, [
                    allocationId,
                    allocAttrs.ip,
                    resolvedAlias,
                    allocAttrs.port,
                    nodeId
                ]);
                synced++;
            } catch (error) {
                const allocationId = allocation.id || allocation.attributes?.id || 'unknown';
                console.error(`Error syncing allocation ${allocationId}:`, error);
                // If it's a duplicate key error, that's okay - allocation already exists
                if (error.message && (error.message.includes('UNIQUE constraint') || error.message.includes('UNIQUE'))) {
                    console.log(`[INFO] Allocation ${allocationId} already exists, skipping`);
                }
            }
        }
        
        res.json({ 
            success: true, 
            message: `Successfully synced ${synced} allocations (cleared ${removed} old entries)`,
            synced: synced,
            removed: removed,
            total: allocations.length
        });
    } catch (error) {
        console.error('Error syncing allocations:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error syncing allocations' 
        });
    }
});

router.get('/api/panel/allocations/cached', requireAdmin, async (req, res) => {
    try {
        const allocations = await query('SELECT * FROM pterodactyl_allocations WHERE is_active = 1 ORDER BY priority DESC, ip, port');
        res.json({ success: true, allocations });
    } catch (error) {
        console.error('Error fetching cached allocations:', error);
        res.status(500).json({ success: false, message: 'Error fetching cached allocations' });
    }
});

router.put('/api/panel/allocations/:id/priority', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { priority } = req.body;
        
        if (priority === undefined || priority === null) {
            return res.status(400).json({ success: false, message: 'Priority is required' });
        }
        
        await run('UPDATE pterodactyl_allocations SET priority = ? WHERE id = ?', [priority, id]);
        
        res.json({ success: true, message: 'Allocation priority updated' });
    } catch (error) {
        console.error('Error updating allocation priority:', error);
        res.status(500).json({ success: false, message: 'Error updating allocation priority' });
    }
});

// Update ip_alias for a locally-stored allocation
router.patch('/api/panel/allocations/:id/alias', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { id } = req.params;
        const { ip_alias } = req.body;

        const alias = ip_alias && ip_alias.trim() !== '' ? ip_alias.trim() : null;

        // Allow clearing the alias, otherwise enforce a basic hostname/IP-safe format
        if (alias && !/^[a-zA-Z0-9.\-]+$/.test(alias)) {
            return res.status(400).json({
                success: false,
                message: 'ip_alias can only contain letters, numbers, dots, and hyphens'
            });
        }

        const result = await run(
            'UPDATE pterodactyl_allocations SET ip_alias = ? WHERE id = ?',
            [alias, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Allocation not found' });
        }

        res.json({
            success: true,
            message: alias ? `ip_alias updated to ${alias}` : 'ip_alias cleared',
            ip_alias: alias
        });
    } catch (error) {
        console.error('Error updating ip_alias:', error);
        res.status(500).json({ success: false, message: 'Error updating ip_alias' });
    }
});

// Get all configured node default aliases
router.get('/api/panel/node-aliases', requireAdmin, async (req, res) => {
    try {
        const aliases = await query(
            'SELECT * FROM pterodactyl_node_aliases ORDER BY node_id ASC'
        );
        res.json({ success: true, aliases });
    } catch (error) {
        console.error('Error fetching node aliases:', error);
        res.status(500).json({ success: false, message: 'Error fetching node aliases' });
    }
});

// Set or clear the default alias for a node
router.post('/api/panel/node-aliases', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { node_id, default_alias } = req.body;

        if (!node_id) {
            return res.status(400).json({ success: false, message: 'node_id is required' });
        }

        const alias = default_alias && String(default_alias).trim() !== ''
            ? String(default_alias).trim()
            : null;

        if (alias && !/^[a-zA-Z0-9.\-]+$/.test(alias)) {
            return res.status(400).json({
                success: false,
                message: 'Alias can only contain letters, numbers, dots, and hyphens'
            });
        }

        const existing = await get(
            'SELECT id FROM pterodactyl_node_aliases WHERE node_id = ?',
            [node_id]
        );

        if (existing) {
            await run(
                'UPDATE pterodactyl_node_aliases SET default_alias = ?, updated_at = CURRENT_TIMESTAMP WHERE node_id = ?',
                [alias, node_id]
            );
        } else {
            await run(
                'INSERT INTO pterodactyl_node_aliases (node_id, default_alias) VALUES (?, ?)',
                [node_id, alias]
            );
        }

        res.json({
            success: true,
            message: alias
                ? `Default alias for node ${node_id} set to ${alias}`
                : `Default alias for node ${node_id} cleared`
        });
    } catch (error) {
        console.error('Error saving node alias:', error);
        res.status(500).json({ success: false, message: 'Error saving node alias' });
    }
});

// Pterodactyl Settings API
router.get('/api/panel/settings', requireAdmin, async (req, res) => {
    try {
        const settings = await get('SELECT * FROM pterodactyl_settings ORDER BY id DESC LIMIT 1');
        res.json({ 
            success: true, 
            settings: settings || { default_nest_id: null, default_location_id: null }
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ success: false, message: 'Error fetching settings' });
    }
});

router.post('/api/panel/settings', requireAdmin, async (req, res) => {
    try {
        const { default_nest_id, default_location_id } = req.body;
        
        // Check if settings exist
        const existing = await get('SELECT id FROM pterodactyl_settings ORDER BY id DESC LIMIT 1');
        
        if (existing) {
            await run(
                'UPDATE pterodactyl_settings SET default_nest_id = ?, default_location_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [default_nest_id || null, default_location_id || null, existing.id]
            );
        } else {
            await run(
                'INSERT INTO pterodactyl_settings (default_nest_id, default_location_id) VALUES (?, ?)',
                [default_nest_id || null, default_location_id || null]
            );
        }
        
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, message: 'Error saving settings' });
    }
});

// Branding Settings API
// Get branding settings (public - accessible to all users)
router.get('/api/branding', async (req, res) => {
    try {
        const settings = await get('SELECT * FROM dashboard_settings ORDER BY id DESC LIMIT 1');
        res.json({
            success: true,
            settings: settings || {
                dashboard_name: 'Aether Dashboard',
                logo_path: '/assets/defaults/aether-dashboard-logo.png',
                favicon_path: '/assets/defaults/aether-dashboard-favicon.ico',
                logo_shape: 'square'
            }
        });
    } catch (error) {
        console.error('Error fetching branding settings:', error);
        res.status(500).json({ success: false, message: 'Error fetching branding settings' });
    }
});

// Save branding settings (with file upload)
router.post('/api/branding', requireAdmin, (req, res, next) => {
    // Ensure branding directory exists before processing
    fs.mkdir(uploadPath, { recursive: true })
        .then(() => {
            // Use multer middleware
            brandingUpload(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ success: false, message: err.message });
                }
                next();
            });
        })
        .catch(err => {
            console.error('Error creating upload directory:', err);
            res.status(500).json({ success: false, message: 'Error setting up upload directory' });
        });
}, async (req, res) => {
    try {
        const { dashboard_name } = req.body;
        
        if (!dashboard_name || dashboard_name.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Dashboard name is required' });
        }
        
        // Get current settings
        const currentSettings = await get('SELECT * FROM dashboard_settings ORDER BY id DESC LIMIT 1');
        
        let logoPath = currentSettings?.logo_path || '/assets/defaults/aether-dashboard-logo.png';
        let faviconPath = currentSettings?.favicon_path || '/assets/defaults/aether-dashboard-favicon.ico';
        const logoShape = req.body.logo_shape || currentSettings?.logo_shape || 'square';
        
        // Update paths if files were uploaded
        if (req.files && req.files.logo && req.files.logo[0]) {
            logoPath = `/assets/branding/${req.files.logo[0].filename}`;
        }
        
        if (req.files && req.files.favicon && req.files.favicon[0]) {
            faviconPath = `/assets/branding/${req.files.favicon[0].filename}`;
        }
        
        // Save or update settings
        if (currentSettings) {
            await run(
                'UPDATE dashboard_settings SET dashboard_name = ?, logo_path = ?, favicon_path = ?, logo_shape = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [dashboard_name.trim(), logoPath, faviconPath, logoShape, currentSettings.id]
            );
        } else {
            await run(
                'INSERT INTO dashboard_settings (dashboard_name, logo_path, favicon_path, logo_shape) VALUES (?, ?, ?, ?)',
                [dashboard_name.trim(), logoPath, faviconPath, logoShape]
            );
        }
        
        res.json({
            success: true,
            message: 'Branding settings saved successfully',
            settings: {
                dashboard_name: dashboard_name.trim(),
                logo_path: logoPath,
                favicon_path: faviconPath,
                logo_shape: logoShape
            }
        });
    } catch (error) {
        console.error('Error saving branding settings:', error);
        res.status(500).json({ success: false, message: 'Error saving branding settings' });
    }
});

// Reset branding to default
router.post('/api/branding/reset', requireAdmin, async (req, res) => {
    try {
        const uploadPath = path.join(__dirname, '../public/assets/branding');
        
        // Delete custom files if they exist
        const customFiles = [
            'custom-logo.png', 'custom-logo.jpg', 'custom-logo.jpeg', 'custom-logo.svg',
            'custom-favicon.ico', 'custom-favicon.png', 'custom-favicon.svg'
        ];
        
        for (const file of customFiles) {
            try {
                await fs.unlink(path.join(uploadPath, file));
            } catch (err) {
                // File doesn't exist, that's okay
            }
        }
        
        // Reset settings to default
        const currentSettings = await get('SELECT * FROM dashboard_settings ORDER BY id DESC LIMIT 1');
        if (currentSettings) {
            await run(
                'UPDATE dashboard_settings SET dashboard_name = ?, logo_path = ?, favicon_path = ?, logo_shape = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['Aether Dashboard', '/assets/defaults/aether-dashboard-logo.png', '/assets/defaults/aether-dashboard-favicon.ico', 'square', currentSettings.id]
            );
        }
        
        res.json({ success: true, message: 'Branding reset to default successfully' });
    } catch (error) {
        console.error('Error resetting branding:', error);
        res.status(500).json({ success: false, message: 'Error resetting branding' });
    }
});

// ============================================
// FEATURE 2: Server Templates Management
// ============================================

// Get all server templates
router.get('/api/templates', requireAdmin, async (req, res) => {
    try {
        const templates = await query('SELECT * FROM server_templates ORDER BY display_order ASC, created_at DESC');
        res.json({ success: true, templates: templates || [] });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: 'Error fetching templates' });
    }
});

// Create a new server template
router.post('/api/templates', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const { name, description, egg_id, ram_mb, cpu_percent, storage_mb, icon, display_order } = req.body;
        
        // Validate required fields
        if (!name || !egg_id) {
            return res.status(400).json({ success: false, message: 'Name and egg are required' });
        }
        
        // Validate numeric values
        const ramValue = parseInt(ram_mb) || 1024;
        const cpuValue = parseInt(cpu_percent) || 100;
        const storageValue = parseInt(storage_mb) || 5120;
        const orderValue = parseInt(display_order) || 0;
        const iconValue = typeof icon === 'string' ? icon.trim() : '';

        if (!isValidTemplateIcon(iconValue)) {
            return res.status(400).json({ success: false, message: 'Invalid template icon value' });
        }
        
        const result = await run(
            `INSERT INTO server_templates (name, description, egg_id, ram_mb, cpu_percent, storage_mb, icon, display_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), description?.trim() || '', parseInt(egg_id), ramValue, cpuValue, storageValue, iconValue || '🎮', orderValue]
        );
        
        res.json({ 
            success: true, 
            message: 'Template created successfully',
            template_id: result.lastID
        });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ success: false, message: 'Error creating template' });
    }
});

// Update a server template
router.put('/api/templates/:id', requireAdmin, sanitizeBody, async (req, res) => {
    try {
        const templateId = req.params.id;
        const { name, description, egg_id, ram_mb, cpu_percent, storage_mb, is_active, icon, display_order } = req.body;
        
        // Check if template exists
        const template = await get('SELECT * FROM server_templates WHERE id = ?', [templateId]);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        
        if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description.trim()); }
        if (egg_id !== undefined) { updates.push('egg_id = ?'); values.push(parseInt(egg_id)); }
        if (ram_mb !== undefined) { updates.push('ram_mb = ?'); values.push(parseInt(ram_mb)); }
        if (cpu_percent !== undefined) { updates.push('cpu_percent = ?'); values.push(parseInt(cpu_percent)); }
        if (storage_mb !== undefined) { updates.push('storage_mb = ?'); values.push(parseInt(storage_mb)); }
        if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }
        if (icon !== undefined) {
            const iconValue = typeof icon === 'string' ? icon.trim() : '';
            if (!isValidTemplateIcon(iconValue)) {
                return res.status(400).json({ success: false, message: 'Invalid template icon value' });
            }
            updates.push('icon = ?');
            values.push(iconValue || '🎮');
        }
        if (display_order !== undefined) { updates.push('display_order = ?'); values.push(parseInt(display_order)); }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(templateId);
        
        await run(
            `UPDATE server_templates SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        res.json({ success: true, message: 'Template updated successfully' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ success: false, message: 'Error updating template' });
    }
});

// Delete a server template
router.delete('/api/templates/:id', requireAdmin, async (req, res) => {
    try {
        const templateId = req.params.id;
        
        // Check if template exists
        const template = await get('SELECT * FROM server_templates WHERE id = ?', [templateId]);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        
        await run('DELETE FROM server_templates WHERE id = ?', [templateId]);
        
        res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ success: false, message: 'Error deleting template' });
    }
});

// Toggle template active status
router.post('/api/templates/:id/toggle', requireAdmin, async (req, res) => {
    try {
        const templateId = req.params.id;
        
        // Get current status
        const template = await get('SELECT * FROM server_templates WHERE id = ?', [templateId]);
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }
        
        const newStatus = template.is_active ? 0 : 1;
        await run('UPDATE server_templates SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, templateId]);
        
        res.json({ 
            success: true, 
            message: `Template ${newStatus ? 'activated' : 'deactivated'} successfully`,
            is_active: newStatus
        });
    } catch (error) {
        console.error('Error toggling template:', error);
        res.status(500).json({ success: false, message: 'Error toggling template status' });
    }
});

// Upload template icon (SVG only)
router.post('/api/templates/icon-upload', requireAdmin, (req, res, next) => {
    fs.mkdir(templateIconUploadPath, { recursive: true })
        .then(() => {
            templateIconUpload.single('icon')(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ success: false, message: err.message });
                }
                next();
            });
        })
        .catch((error) => {
            console.error('Error creating template icon upload directory:', error);
            res.status(500).json({ success: false, message: 'Error setting up template icon upload directory' });
        });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'SVG file is required' });
        }
        const iconPath = `/icons/template-icons/${req.file.filename}`;
        return res.json({
            success: true,
            message: 'Template icon uploaded successfully',
            icon_path: iconPath
        });
    } catch (error) {
        console.error('Error uploading template icon:', error);
        res.status(500).json({ success: false, message: 'Error uploading template icon' });
    }
});

// ============================================
// Theme Customization Settings (v1.3)
// ============================================

// Preset themes configuration
const PRESET_THEMES = {
    ocean: {
        name: 'Ocean Blue',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#0369a1',
        sidebar_color_2: '#0891b2',
        sidebar_color_3: '#06b6d4',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#ffffff',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.25)',
        sidebar_hover_bg: 'rgba(255, 255, 255, 0.15)',
        main_bg_type: 'gradient',
        main_color_1: '#0c1929',
        main_color_2: '#0f2744',
        main_color_3: '#164e63',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(12, 74, 110, 0.4)',
        card_border_color: 'rgba(8, 145, 178, 0.3)',
        card_text_color: '#f0f9ff',
        accent_primary: '#0891b2',
        accent_secondary: '#06b6d4',
        accent_tertiary: '#22d3ee',
        accent_success: '#10b981',
        accent_warning: '#f59e0b',
        accent_danger: '#ef4444',
        input_bg_color: 'rgba(12, 74, 110, 0.3)',
        input_border_color: 'rgba(8, 145, 178, 0.3)',
        input_text_color: '#f0f9ff',
        input_placeholder_color: '#7dd3fc',
        header_bg_color: 'rgba(12, 74, 110, 0.8)',
        header_text_color: '#f0f9ff'
    },
    sunset: {
        name: 'Sunset Orange',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#ea580c',
        sidebar_color_2: '#f97316',
        sidebar_color_3: '#facc15',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#ffffff',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.25)',
        sidebar_hover_bg: 'rgba(255, 255, 255, 0.15)',
        main_bg_type: 'gradient',
        main_color_1: '#1c1410',
        main_color_2: '#292017',
        main_color_3: '#3d2a14',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(60, 30, 20, 0.6)',
        card_border_color: 'rgba(249, 115, 22, 0.3)',
        card_text_color: '#fff7ed',
        accent_primary: '#f97316',
        accent_secondary: '#fb923c',
        accent_tertiary: '#facc15',
        accent_success: '#22c55e',
        accent_warning: '#eab308',
        accent_danger: '#dc2626',
        input_bg_color: 'rgba(60, 30, 20, 0.4)',
        input_border_color: 'rgba(249, 115, 22, 0.3)',
        input_text_color: '#fff7ed',
        input_placeholder_color: '#fdba74',
        header_bg_color: 'rgba(50, 25, 15, 0.8)',
        header_text_color: '#fff7ed'
    },
    forest: {
        name: 'Forest Green',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#166534',
        sidebar_color_2: '#22c55e',
        sidebar_color_3: '#86efac',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#ffffff',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.25)',
        sidebar_hover_bg: 'rgba(255, 255, 255, 0.15)',
        main_bg_type: 'gradient',
        main_color_1: '#0a1a10',
        main_color_2: '#14261a',
        main_color_3: '#1a3323',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(20, 50, 30, 0.6)',
        card_border_color: 'rgba(34, 197, 94, 0.3)',
        card_text_color: '#f0fdf4',
        accent_primary: '#22c55e',
        accent_secondary: '#4ade80',
        accent_tertiary: '#86efac',
        accent_success: '#10b981',
        accent_warning: '#f59e0b',
        accent_danger: '#ef4444',
        input_bg_color: 'rgba(20, 50, 30, 0.4)',
        input_border_color: 'rgba(34, 197, 94, 0.3)',
        input_text_color: '#f0fdf4',
        input_placeholder_color: '#86efac',
        header_bg_color: 'rgba(20, 50, 30, 0.8)',
        header_text_color: '#f0fdf4'
    },
    midnight: {
        name: 'Midnight Dark',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#18181b',
        sidebar_color_2: '#27272a',
        sidebar_color_3: '#3f3f46',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#fafafa',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.15)',
        sidebar_hover_bg: 'rgba(255, 255, 255, 0.1)',
        main_bg_type: 'gradient',
        main_color_1: '#09090b',
        main_color_2: '#18181b',
        main_color_3: '#27272a',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(39, 39, 42, 0.6)',
        card_border_color: 'rgba(113, 113, 122, 0.3)',
        card_text_color: '#fafafa',
        accent_primary: '#a1a1aa',
        accent_secondary: '#d4d4d8',
        accent_tertiary: '#e4e4e7',
        accent_success: '#22c55e',
        accent_warning: '#f59e0b',
        accent_danger: '#ef4444',
        input_bg_color: 'rgba(39, 39, 42, 0.4)',
        input_border_color: 'rgba(113, 113, 122, 0.3)',
        input_text_color: '#fafafa',
        input_placeholder_color: '#a1a1aa',
        header_bg_color: 'rgba(24, 24, 27, 0.9)',
        header_text_color: '#fafafa'
    },
    rose: {
        name: 'Rose Pink',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#be185d',
        sidebar_color_2: '#ec4899',
        sidebar_color_3: '#f472b6',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#ffffff',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.25)',
        sidebar_hover_bg: 'rgba(255, 255, 255, 0.15)',
        main_bg_type: 'gradient',
        main_color_1: '#1a0a14',
        main_color_2: '#2a1020',
        main_color_3: '#3d1530',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(60, 20, 40, 0.6)',
        card_border_color: 'rgba(236, 72, 153, 0.3)',
        card_text_color: '#fdf2f8',
        accent_primary: '#ec4899',
        accent_secondary: '#f472b6',
        accent_tertiary: '#f9a8d4',
        accent_success: '#10b981',
        accent_warning: '#f59e0b',
        accent_danger: '#ef4444',
        input_bg_color: 'rgba(60, 20, 40, 0.4)',
        input_border_color: 'rgba(236, 72, 153, 0.3)',
        input_text_color: '#fdf2f8',
        input_placeholder_color: '#f9a8d4',
        header_bg_color: 'rgba(50, 15, 35, 0.8)',
        header_text_color: '#fdf2f8'
    },
    // Glassmorphism / gamified HUD-style presets (active_preset id prefix glass_ → client glass mode)
    glass_frost: {
        name: 'Frost Cyan',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#0c4a6e',
        sidebar_color_2: '#0891b2',
        sidebar_color_3: '#22d3ee',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#ecfeff',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.18)',
        sidebar_hover_bg: 'rgba(34, 211, 238, 0.15)',
        main_bg_type: 'gradient',
        main_color_1: '#020617',
        main_color_2: '#0f172a',
        main_color_3: '#134e4a',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(255, 255, 255, 0.07)',
        card_border_color: 'rgba(34, 211, 238, 0.4)',
        card_text_color: '#f0fdfa',
        accent_primary: '#22d3ee',
        accent_secondary: '#06b6d4',
        accent_tertiary: '#67e8f9',
        accent_success: '#34d399',
        accent_warning: '#fbbf24',
        accent_danger: '#fb7185',
        input_bg_color: 'rgba(15, 23, 42, 0.45)',
        input_border_color: 'rgba(34, 211, 238, 0.35)',
        input_text_color: '#ecfeff',
        input_placeholder_color: '#5eead4',
        header_bg_color: 'rgba(8, 47, 73, 0.55)',
        header_text_color: '#ecfeff'
    },
    glass_nexus: {
        name: 'Nexus HUD',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#172554',
        sidebar_color_2: '#1e40af',
        sidebar_color_3: '#0e7490',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#f8fafc',
        sidebar_active_bg: 'rgba(56, 189, 248, 0.2)',
        sidebar_hover_bg: 'rgba(56, 189, 248, 0.12)',
        main_bg_type: 'gradient',
        main_color_1: '#030712',
        main_color_2: '#111827',
        main_color_3: '#1e293b',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(15, 23, 42, 0.5)',
        card_border_color: 'rgba(56, 189, 248, 0.28)',
        card_text_color: '#f1f5f9',
        accent_primary: '#38bdf8',
        accent_secondary: '#4ade80',
        accent_tertiary: '#22d3ee',
        accent_success: '#4ade80',
        accent_warning: '#facc15',
        accent_danger: '#f87171',
        input_bg_color: 'rgba(30, 41, 59, 0.55)',
        input_border_color: 'rgba(56, 189, 248, 0.3)',
        input_text_color: '#f8fafc',
        input_placeholder_color: '#94a3b8',
        header_bg_color: 'rgba(15, 23, 42, 0.75)',
        header_text_color: '#f8fafc'
    },
    glass_prism: {
        name: 'Prism Aura',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#4c1d95',
        sidebar_color_2: '#7c3aed',
        sidebar_color_3: '#0891b2',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#ffffff',
        sidebar_active_bg: 'rgba(255, 255, 255, 0.2)',
        sidebar_hover_bg: 'rgba(167, 139, 250, 0.2)',
        main_bg_type: 'gradient',
        main_color_1: '#1e1b4b',
        main_color_2: '#172554',
        main_color_3: '#0c4a6e',
        main_gradient_direction: '140deg',
        card_bg_color: 'rgba(255, 255, 255, 0.08)',
        card_border_color: 'rgba(167, 139, 250, 0.38)',
        card_text_color: '#faf5ff',
        accent_primary: '#a78bfa',
        accent_secondary: '#22d3ee',
        accent_tertiary: '#34d399',
        accent_success: '#34d399',
        accent_warning: '#fbbf24',
        accent_danger: '#fb7185',
        input_bg_color: 'rgba(49, 46, 129, 0.4)',
        input_border_color: 'rgba(167, 139, 250, 0.35)',
        input_text_color: '#faf5ff',
        input_placeholder_color: '#c4b5fd',
        header_bg_color: 'rgba(30, 27, 75, 0.65)',
        header_text_color: '#faf5ff'
    },
    glass_cyber: {
        name: 'Cyber Neon',
        sidebar_bg_type: 'gradient',
        sidebar_color_1: '#86198f',
        sidebar_color_2: '#c026d3',
        sidebar_color_3: '#06b6d4',
        sidebar_gradient_direction: '180deg',
        sidebar_text_color: '#fdf4ff',
        sidebar_active_bg: 'rgba(244, 114, 182, 0.22)',
        sidebar_hover_bg: 'rgba(6, 182, 212, 0.18)',
        main_bg_type: 'gradient',
        main_color_1: '#0a0a0f',
        main_color_2: '#18181b',
        main_color_3: '#1e1b4b',
        main_gradient_direction: '135deg',
        card_bg_color: 'rgba(255, 255, 255, 0.05)',
        card_border_color: 'rgba(244, 114, 182, 0.38)',
        card_text_color: '#fafafa',
        accent_primary: '#f472b6',
        accent_secondary: '#22d3ee',
        accent_tertiary: '#e879f9',
        accent_success: '#4ade80',
        accent_warning: '#fbbf24',
        accent_danger: '#fb7185',
        input_bg_color: 'rgba(24, 24, 27, 0.55)',
        input_border_color: 'rgba(244, 114, 182, 0.3)',
        input_text_color: '#fafafa',
        input_placeholder_color: '#d4d4d8',
        header_bg_color: 'rgba(10, 10, 15, 0.82)',
        header_text_color: '#fafafa'
    }
};

/** Default preset for new installs, API fallbacks, and theme reset */
const DEFAULT_PRESET_ID = 'midnight';

// Get theme settings (public - all users need this to render the dashboard)
router.get('/api/theme', async (req, res) => {
    try {
        const theme = await get('SELECT * FROM theme_settings ORDER BY id DESC LIMIT 1');
        
        // If no theme exists, return default
        if (!theme) {
            return res.json({
                success: true,
                theme: PRESET_THEMES[DEFAULT_PRESET_ID],
                active_preset: DEFAULT_PRESET_ID
            });
        }
        
        res.json({
            success: true,
            theme: theme,
            active_preset: theme.active_preset || DEFAULT_PRESET_ID
        });
    } catch (error) {
        console.error('Error fetching theme settings:', error);
        // Return default theme on error
        res.json({
            success: true,
            theme: PRESET_THEMES[DEFAULT_PRESET_ID],
            active_preset: DEFAULT_PRESET_ID
        });
    }
});

// Get available preset themes
router.get('/api/theme/presets', requireAdmin, (req, res) => {
    const presetOrder = ['midnight', 'ocean', 'sunset', 'forest', 'rose'];
    const glassPresetOrder = ['glass_frost', 'glass_nexus', 'glass_prism', 'glass_cyber'];
    const presets = presetOrder
        .filter((id) => PRESET_THEMES[id])
        .map((id) => ({ id, name: PRESET_THEMES[id].name }));
    const glassPresets = glassPresetOrder
        .filter((id) => PRESET_THEMES[id])
        .map((id) => ({ id, name: PRESET_THEMES[id].name }));

    res.json({
        success: true,
        presets,
        glassPresets
    });
});

// Apply a preset theme
router.post('/api/theme/preset/:presetId', requireAdmin, async (req, res) => {
    try {
        const presetId = req.params.presetId;
        
        if (!PRESET_THEMES[presetId]) {
            return res.status(400).json({ success: false, message: 'Invalid preset theme' });
        }
        
        const preset = PRESET_THEMES[presetId];
        
        // Check if theme settings exist
        const existingTheme = await get('SELECT id FROM theme_settings LIMIT 1');
        
        if (existingTheme) {
            // Update existing theme
            await run(`
                UPDATE theme_settings SET
                    sidebar_bg_type = ?,
                    sidebar_color_1 = ?,
                    sidebar_color_2 = ?,
                    sidebar_color_3 = ?,
                    sidebar_gradient_direction = ?,
                    sidebar_text_color = ?,
                    sidebar_active_bg = ?,
                    sidebar_hover_bg = ?,
                    main_bg_type = ?,
                    main_color_1 = ?,
                    main_color_2 = ?,
                    main_color_3 = ?,
                    main_gradient_direction = ?,
                    card_bg_color = ?,
                    card_border_color = ?,
                    card_text_color = ?,
                    accent_primary = ?,
                    accent_secondary = ?,
                    accent_tertiary = ?,
                    accent_success = ?,
                    accent_warning = ?,
                    accent_danger = ?,
                    input_bg_color = ?,
                    input_border_color = ?,
                    input_text_color = ?,
                    input_placeholder_color = ?,
                    header_bg_color = ?,
                    header_text_color = ?,
                    active_preset = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                preset.sidebar_bg_type,
                preset.sidebar_color_1,
                preset.sidebar_color_2,
                preset.sidebar_color_3,
                preset.sidebar_gradient_direction,
                preset.sidebar_text_color,
                preset.sidebar_active_bg,
                preset.sidebar_hover_bg,
                preset.main_bg_type,
                preset.main_color_1,
                preset.main_color_2,
                preset.main_color_3,
                preset.main_gradient_direction,
                preset.card_bg_color,
                preset.card_border_color,
                preset.card_text_color,
                preset.accent_primary,
                preset.accent_secondary,
                preset.accent_tertiary,
                preset.accent_success,
                preset.accent_warning,
                preset.accent_danger,
                preset.input_bg_color,
                preset.input_border_color,
                preset.input_text_color,
                preset.input_placeholder_color,
                preset.header_bg_color,
                preset.header_text_color,
                presetId,
                existingTheme.id
            ]);
        } else {
            // Insert new theme
            await run(`
                INSERT INTO theme_settings (
                    sidebar_bg_type, sidebar_color_1, sidebar_color_2, sidebar_color_3,
                    sidebar_gradient_direction, sidebar_text_color, sidebar_active_bg, sidebar_hover_bg,
                    main_bg_type, main_color_1, main_color_2, main_color_3, main_gradient_direction,
                    card_bg_color, card_border_color, card_text_color,
                    accent_primary, accent_secondary, accent_tertiary, accent_success, accent_warning, accent_danger,
                    input_bg_color, input_border_color, input_text_color, input_placeholder_color,
                    header_bg_color, header_text_color, active_preset
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                preset.sidebar_bg_type,
                preset.sidebar_color_1,
                preset.sidebar_color_2,
                preset.sidebar_color_3,
                preset.sidebar_gradient_direction,
                preset.sidebar_text_color,
                preset.sidebar_active_bg,
                preset.sidebar_hover_bg,
                preset.main_bg_type,
                preset.main_color_1,
                preset.main_color_2,
                preset.main_color_3,
                preset.main_gradient_direction,
                preset.card_bg_color,
                preset.card_border_color,
                preset.card_text_color,
                preset.accent_primary,
                preset.accent_secondary,
                preset.accent_tertiary,
                preset.accent_success,
                preset.accent_warning,
                preset.accent_danger,
                preset.input_bg_color,
                preset.input_border_color,
                preset.input_text_color,
                preset.input_placeholder_color,
                preset.header_bg_color,
                preset.header_text_color,
                presetId
            ]);
        }
        
        res.json({ 
            success: true, 
            message: `Theme "${preset.name}" applied successfully`,
            theme: preset
        });
    } catch (error) {
        console.error('Error applying preset theme:', error);
        res.status(500).json({ success: false, message: 'Error applying theme' });
    }
});

// Save custom theme settings
router.post('/api/theme', requireAdmin, async (req, res) => {
    try {
        const {
            sidebar_bg_type, sidebar_color_1, sidebar_color_2, sidebar_color_3,
            sidebar_gradient_direction, sidebar_text_color, sidebar_active_bg, sidebar_hover_bg,
            main_bg_type, main_color_1, main_color_2, main_color_3, main_gradient_direction,
            card_bg_color, card_border_color, card_text_color,
            accent_primary, accent_secondary, accent_tertiary, accent_success, accent_warning, accent_danger,
            input_bg_color, input_border_color, input_text_color, input_placeholder_color,
            header_bg_color, header_text_color
        } = req.body;
        
        // Check if theme settings exist
        const existingTheme = await get('SELECT id FROM theme_settings LIMIT 1');
        
        if (existingTheme) {
            // Update existing theme
            await run(`
                UPDATE theme_settings SET
                    sidebar_bg_type = COALESCE(?, sidebar_bg_type),
                    sidebar_color_1 = COALESCE(?, sidebar_color_1),
                    sidebar_color_2 = COALESCE(?, sidebar_color_2),
                    sidebar_color_3 = COALESCE(?, sidebar_color_3),
                    sidebar_gradient_direction = COALESCE(?, sidebar_gradient_direction),
                    sidebar_text_color = COALESCE(?, sidebar_text_color),
                    sidebar_active_bg = COALESCE(?, sidebar_active_bg),
                    sidebar_hover_bg = COALESCE(?, sidebar_hover_bg),
                    main_bg_type = COALESCE(?, main_bg_type),
                    main_color_1 = COALESCE(?, main_color_1),
                    main_color_2 = COALESCE(?, main_color_2),
                    main_color_3 = COALESCE(?, main_color_3),
                    main_gradient_direction = COALESCE(?, main_gradient_direction),
                    card_bg_color = COALESCE(?, card_bg_color),
                    card_border_color = COALESCE(?, card_border_color),
                    card_text_color = COALESCE(?, card_text_color),
                    accent_primary = COALESCE(?, accent_primary),
                    accent_secondary = COALESCE(?, accent_secondary),
                    accent_tertiary = COALESCE(?, accent_tertiary),
                    accent_success = COALESCE(?, accent_success),
                    accent_warning = COALESCE(?, accent_warning),
                    accent_danger = COALESCE(?, accent_danger),
                    input_bg_color = COALESCE(?, input_bg_color),
                    input_border_color = COALESCE(?, input_border_color),
                    input_text_color = COALESCE(?, input_text_color),
                    input_placeholder_color = COALESCE(?, input_placeholder_color),
                    header_bg_color = COALESCE(?, header_bg_color),
                    header_text_color = COALESCE(?, header_text_color),
                    active_preset = 'custom',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                sidebar_bg_type, sidebar_color_1, sidebar_color_2, sidebar_color_3,
                sidebar_gradient_direction, sidebar_text_color, sidebar_active_bg, sidebar_hover_bg,
                main_bg_type, main_color_1, main_color_2, main_color_3, main_gradient_direction,
                card_bg_color, card_border_color, card_text_color,
                accent_primary, accent_secondary, accent_tertiary, accent_success, accent_warning, accent_danger,
                input_bg_color, input_border_color, input_text_color, input_placeholder_color,
                header_bg_color, header_text_color,
                existingTheme.id
            ]);
        } else {
            // Insert new theme with custom preset
            const defaultTheme = PRESET_THEMES[DEFAULT_PRESET_ID];
            await run(`
                INSERT INTO theme_settings (
                    sidebar_bg_type, sidebar_color_1, sidebar_color_2, sidebar_color_3,
                    sidebar_gradient_direction, sidebar_text_color, sidebar_active_bg, sidebar_hover_bg,
                    main_bg_type, main_color_1, main_color_2, main_color_3, main_gradient_direction,
                    card_bg_color, card_border_color, card_text_color,
                    accent_primary, accent_secondary, accent_tertiary, accent_success, accent_warning, accent_danger,
                    input_bg_color, input_border_color, input_text_color, input_placeholder_color,
                    header_bg_color, header_text_color, active_preset
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                sidebar_bg_type || defaultTheme.sidebar_bg_type,
                sidebar_color_1 || defaultTheme.sidebar_color_1,
                sidebar_color_2 || defaultTheme.sidebar_color_2,
                sidebar_color_3 || defaultTheme.sidebar_color_3,
                sidebar_gradient_direction || defaultTheme.sidebar_gradient_direction,
                sidebar_text_color || defaultTheme.sidebar_text_color,
                sidebar_active_bg || defaultTheme.sidebar_active_bg,
                sidebar_hover_bg || defaultTheme.sidebar_hover_bg,
                main_bg_type || defaultTheme.main_bg_type,
                main_color_1 || defaultTheme.main_color_1,
                main_color_2 || defaultTheme.main_color_2,
                main_color_3 || defaultTheme.main_color_3,
                main_gradient_direction || defaultTheme.main_gradient_direction,
                card_bg_color || defaultTheme.card_bg_color,
                card_border_color || defaultTheme.card_border_color,
                card_text_color || defaultTheme.card_text_color,
                accent_primary || defaultTheme.accent_primary,
                accent_secondary || defaultTheme.accent_secondary,
                accent_tertiary || defaultTheme.accent_tertiary,
                accent_success || defaultTheme.accent_success,
                accent_warning || defaultTheme.accent_warning,
                accent_danger || defaultTheme.accent_danger,
                input_bg_color || defaultTheme.input_bg_color,
                input_border_color || defaultTheme.input_border_color,
                input_text_color || defaultTheme.input_text_color,
                input_placeholder_color || defaultTheme.input_placeholder_color,
                header_bg_color || defaultTheme.header_bg_color,
                header_text_color || defaultTheme.header_text_color,
                'custom'
            ]);
        }
        
        res.json({ success: true, message: 'Theme settings saved successfully' });
    } catch (error) {
        console.error('Error saving theme settings:', error);
        res.status(500).json({ success: false, message: 'Error saving theme settings' });
    }
});

// Reset theme to default
router.post('/api/theme/reset', requireAdmin, async (req, res) => {
    try {
        const defaultTheme = PRESET_THEMES[DEFAULT_PRESET_ID];
        const existingTheme = await get('SELECT id FROM theme_settings LIMIT 1');
        
        if (existingTheme) {
            await run(`
                UPDATE theme_settings SET
                    sidebar_bg_type = ?,
                    sidebar_color_1 = ?,
                    sidebar_color_2 = ?,
                    sidebar_color_3 = ?,
                    sidebar_gradient_direction = ?,
                    sidebar_text_color = ?,
                    sidebar_active_bg = ?,
                    sidebar_hover_bg = ?,
                    main_bg_type = ?,
                    main_color_1 = ?,
                    main_color_2 = ?,
                    main_color_3 = ?,
                    main_gradient_direction = ?,
                    card_bg_color = ?,
                    card_border_color = ?,
                    card_text_color = ?,
                    accent_primary = ?,
                    accent_secondary = ?,
                    accent_tertiary = ?,
                    accent_success = ?,
                    accent_warning = ?,
                    accent_danger = ?,
                    input_bg_color = ?,
                    input_border_color = ?,
                    input_text_color = ?,
                    input_placeholder_color = ?,
                    header_bg_color = ?,
                    header_text_color = ?,
                    active_preset = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                defaultTheme.sidebar_bg_type,
                defaultTheme.sidebar_color_1,
                defaultTheme.sidebar_color_2,
                defaultTheme.sidebar_color_3,
                defaultTheme.sidebar_gradient_direction,
                defaultTheme.sidebar_text_color,
                defaultTheme.sidebar_active_bg,
                defaultTheme.sidebar_hover_bg,
                defaultTheme.main_bg_type,
                defaultTheme.main_color_1,
                defaultTheme.main_color_2,
                defaultTheme.main_color_3,
                defaultTheme.main_gradient_direction,
                defaultTheme.card_bg_color,
                defaultTheme.card_border_color,
                defaultTheme.card_text_color,
                defaultTheme.accent_primary,
                defaultTheme.accent_secondary,
                defaultTheme.accent_tertiary,
                defaultTheme.accent_success,
                defaultTheme.accent_warning,
                defaultTheme.accent_danger,
                defaultTheme.input_bg_color,
                defaultTheme.input_border_color,
                defaultTheme.input_text_color,
                defaultTheme.input_placeholder_color,
                defaultTheme.header_bg_color,
                defaultTheme.header_text_color,
                DEFAULT_PRESET_ID,
                existingTheme.id
            ]);
        }
        
        res.json({ success: true, message: 'Theme reset to default successfully' });
    } catch (error) {
        console.error('Error resetting theme:', error);
        res.status(500).json({ success: false, message: 'Error resetting theme' });
    }
});

module.exports = router;


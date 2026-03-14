// Dashboard Routes
// Main dashboard and related pages

const express = require('express');
const router = express.Router();
const path = require('path');

// Middleware to check if user is logged in
// We'll create this in Phase 3, for now just a placeholder
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Main dashboard page
router.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Profile page
router.get('/profile', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/profile.html'));
});

// Settings page
router.get('/settings', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});

// API endpoint to get current user data
router.get('/api/user', requireAuth, async (req, res) => {
    try {
        const { get, query } = require('../config/database');
        
        // Get latest user data from database (including server_slots and purchased resources)
        const user = await get('SELECT id, username, email, coins, is_admin, server_slots, discord_id, purchased_ram, purchased_cpu, purchased_storage, created_at FROM users WHERE id = ?', [req.session.user.id]);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Get user's server count
        const serverCount = await get('SELECT COUNT(*) as count FROM servers WHERE user_id = ?', [req.session.user.id]);
        
        // Calculate used resources from all servers
        const usedResources = await get(`
            SELECT 
                SUM(ram) as used_ram,
                SUM(cpu) as used_cpu,
                SUM(storage) as used_storage
            FROM servers 
            WHERE user_id = ?
        `, [req.session.user.id]);
        
        // Update session with latest data
        req.session.user.coins = user.coins;
        req.session.user.server_slots = user.server_slots;
        
        res.json({
            success: true,
            user: {
                ...user,
                server_count: serverCount.count,
                available_slots: user.server_slots - serverCount.count,
                purchased_resources: {
                    ram: user.purchased_ram || 0,
                    cpu: user.purchased_cpu || 0,
                    storage: user.purchased_storage || 0
                },
                used_resources: {
                    ram: usedResources.used_ram || 0,
                    cpu: usedResources.used_cpu || 0,
                    storage: usedResources.used_storage || 0
                },
                available_resources: {
                    ram: (user.purchased_ram || 0) - (usedResources.used_ram || 0),
                    cpu: (user.purchased_cpu || 0) - (usedResources.used_cpu || 0),
                    storage: (user.purchased_storage || 0) - (usedResources.used_storage || 0)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ success: false, message: 'Error fetching user data' });
    }
});

// API endpoint to change password
router.post('/api/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const bcrypt = require('bcrypt');
        const { get, run } = require('../config/database');
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        
        // Get user from database
        const user = await get('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Check if user has a password (Discord users might not have one)
        if (!user.password) {
            return res.status(400).json({ success: false, message: 'Please set a password first' });
        }
        
        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// API endpoint to update email
router.post('/api/update-email', requireAuth, async (req, res) => {
    try {
        const { email } = req.body;
        const { get, run } = require('../config/database');
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        
        // Check if email is already taken
        const existingUser = await get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.session.user.id]);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }
        
        // Update email
        await run('UPDATE users SET email = ? WHERE id = ?', [email, req.session.user.id]);
        
        // Update session
        req.session.user.email = email;
        
        res.json({ success: true, message: 'Email updated successfully' });
    } catch (error) {
        console.error('Update email error:', error);
        res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

// API endpoint to get Discord info
router.get('/api/discord-info', requireAuth, async (req, res) => {
    try {
        const { get } = require('../config/database');
        
        // Get user from database to check Discord ID
        const user = await get('SELECT discord_id FROM users WHERE id = ?', [req.session.user.id]);
        
        if (!user || !user.discord_id) {
            return res.json({ 
                success: false, 
                connected: false,
                message: 'Discord not connected' 
            });
        }
        
        // Note: To get Discord username, you'd need to store it during OAuth
        // For now, we'll just return the Discord ID
        // In a full implementation, you could store the username in the database
        res.json({ 
            success: true, 
            connected: true,
            discord_id: user.discord_id,
            discord_username: null // Could be stored in database during OAuth
        });
    } catch (error) {
        console.error('Discord info error:', error);
        res.status(500).json({ success: false, message: 'An error occurred' });
    }
});

module.exports = router;


// Authentication Routes
// Handles login, signup, and Discord OAuth

const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcrypt');
const passport = require('passport');
const { get, run } = require('../config/database');
const { sanitizeBody, validateSignup, validateLogin } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');
const pterodactyl = require('../config/pterodactyl');

// Middleware to check if user is logged in
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
}

// Login page
router.get('/login', (req, res) => {
    // If already logged in, redirect to dashboard
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../views/login.html'));
});

// Signup page
router.get('/signup', (req, res) => {
    // If already logged in, redirect to dashboard
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, '../views/signup.html'));
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/auth/login');
    });
});

// Login POST handler
router.post('/login', authLimiter, sanitizeBody, validateLogin, async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        // Validate input
        if (!usernameOrEmail || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username/Email and password are required' 
            });
        }

        // Find user by username or email
        // Try username first, then email
        let user = await get('SELECT * FROM users WHERE username = ?', [usernameOrEmail]);
        
        if (!user) {
            // If not found by username, try email
            user = await get('SELECT * FROM users WHERE email = ?', [usernameOrEmail]);
        }

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid username/email or password' 
            });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }

        // BUGFIX #15: Create session with ALL user fields (don't store password in session)
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            coins: user.coins,
            is_admin: user.is_admin === 1,
            discord_id: user.discord_id,
            pterodactyl_user_id: user.pterodactyl_user_id,
            server_slots: user.server_slots || 1
        };

        res.json({ 
            success: true, 
            message: 'Login successful',
            user: req.session.user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred during login' 
        });
    }
});

// Signup POST handler
router.post('/signup', authLimiter, sanitizeBody, validateSignup, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, email, and password are required' 
            });
        }

        // Check password length
        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters long' 
            });
        }

        // Check if username already exists
        const existingUsername = await get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsername) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already exists' 
            });
        }

        // Check if email already exists
        const existingEmail = await get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already exists' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await run(
            'INSERT INTO users (username, email, password, coins) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, 0]
        );

        const userId = result.lastID;
        let pterodactylUserId = null;

        // Auto-create Pterodactyl user if configured
        try {
            const isConfigured = await pterodactyl.isConfigured();
            if (isConfigured) {
                // Check if user already exists in Pterodactyl
                const existingUser = await pterodactyl.getPterodactylUserByEmail(email);
                
                if (!existingUser.success) {
                    // Create new user in Pterodactyl
                    const names = username.split(' ');
                    const firstName = names[0] || username;
                    const lastName = names.slice(1).join(' ') || 'User';
                    
                    const pterodactylUser = await pterodactyl.createPterodactylUser({
                        email: email,
                        username: username,
                        first_name: firstName,
                        last_name: lastName,
                        password: password // Pterodactyl will require password change on first login
                    });
                    
                    if (pterodactylUser.success && pterodactylUser.data) {
                        pterodactylUserId = pterodactylUser.data.id || pterodactylUser.data.attributes?.id;
                        // Update user with Pterodactyl user ID
                        await run('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', 
                            [pterodactylUserId, userId]);
                    } else {
                        console.warn('Failed to create Pterodactyl user:', pterodactylUser.error || pterodactylUser.message);
                    }
                } else {
                    // User already exists, use existing ID
                    pterodactylUserId = existingUser.data.id || existingUser.data.attributes?.id;
                    await run('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', 
                        [pterodactylUserId, userId]);
                }
            }
        } catch (error) {
            console.error('Error creating Pterodactyl user:', error);
            // Don't fail signup if Pterodactyl creation fails
        }

        // BUGFIX #15: Create session with ALL user fields
        req.session.user = {
            id: userId,
            username: username,
            email: email,
            coins: 0,
            is_admin: false,
            discord_id: null,
            pterodactyl_user_id: pterodactylUserId,
            server_slots: 1  // Default for new users
        };

        res.json({ 
            success: true, 
            message: 'Account created successfully',
            user: req.session.user
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred during signup' 
        });
    }
});

// Discord OAuth routes
router.get('/discord', passport.authenticate('discord'));

// Discord linking route (for connecting Discord to existing account)
router.get('/discord/link', requireAuth, (req, res, next) => {
    // Store user ID in session so we can link Discord to this account
    req.session.discordLinkUserId = req.session.user.id;
    passport.authenticate('discord')(req, res, next);
});

router.get('/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/auth/login' }),
    async (req, res) => {
        try {
            const { get, run } = require('../config/database');
            
            // Check if this is a linking operation (user was already logged in)
            if (req.session.discordLinkUserId) {
                const userId = req.session.discordLinkUserId;
                delete req.session.discordLinkUserId;
                
                // Check if Discord ID is already linked to another account
                const existingDiscordUser = await get('SELECT id FROM users WHERE discord_id = ? AND id != ?', 
                    [req.user.discord_id, userId]);
                
                if (existingDiscordUser) {
                    // Discord is already linked to another account
                    return res.redirect('/dashboard/profile?discord=error&message=already_linked');
                }
                
                // Link Discord to the existing account
                await run('UPDATE users SET discord_id = ? WHERE id = ?', 
                    [req.user.discord_id, userId]);
                
                // Get updated user data
                const updatedUser = await get('SELECT * FROM users WHERE id = ?', [userId]);
                
                // Update session with new Discord ID
                req.session.user.discord_id = updatedUser.discord_id;
                
                // Redirect back to profile page with success message
                return res.redirect('/dashboard/profile?discord=linked');
            }
            
            // Regular login/signup flow
            // BUGFIX #15: Create session with ALL user fields
            req.session.user = {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                coins: req.user.coins,
                is_admin: req.user.is_admin === 1,
                discord_id: req.user.discord_id,
                pterodactyl_user_id: req.user.pterodactyl_user_id,
                server_slots: req.user.server_slots || 1
            };
            
            res.redirect('/dashboard');
        } catch (error) {
            console.error('Discord callback error:', error);
            res.redirect('/auth/login?error=discord');
        }
    }
);

module.exports = router;


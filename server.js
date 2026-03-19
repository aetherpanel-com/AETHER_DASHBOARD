// Aether Dashboard - Main Server File
// This is the entry point of our application

// Load environment variables from .env file
require('dotenv').config();

// Global error handlers - catch unhandled errors to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️  Unhandled Rejection at:', promise);
    console.error('⚠️  Reason:', reason);
    // Don't exit - let PM2 handle restarts if needed
});

process.on('uncaughtException', (error) => {
    console.error('⚠️  Uncaught Exception — shutting down for clean restart:', error);
    // MUST exit after uncaughtException — the process is in undefined state.
    // PM2 will restart automatically. Continuing risks data corruption.
    process.exit(1);
});

// Import required modules
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Server } = require('socket.io');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Required when behind Nginx/reverse proxy (production)
// This allows Express to correctly handle X-Forwarded-* headers
// Works in both development and production (harmless if no proxy)
app.set('trust proxy', 1);

// Middleware setup
// This allows us to parse form data and JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Request timeout middleware - prevent requests from hanging indefinitely
app.use((req, res, next) => {
    // Set timeout to 60 seconds for all requests
    req.setTimeout(60000, () => {
        if (!res.headersSent) {
            res.status(503).json({ 
                success: false, 
                message: 'Request timeout. Please try again.' 
            });
        }
    });
    next();
});

// Session configuration
// Sessions help us remember if a user is logged in
// BUGFIX: Security - Ensure SESSION_SECRET is properly configured
const DEFAULT_SECRET = 'aether-dashboard-secret-key-change-in-production';
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SECRET;

// Security check: In production, require a custom SESSION_SECRET
if (isProduction) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
        console.error('❌ SECURITY ERROR: SESSION_SECRET must be set in production!');
        console.error('   Please set a strong, random SESSION_SECRET in your .env file.');
        console.error('   Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        console.error('   Server will not start without a secure SESSION_SECRET.');
        process.exit(1);
    }
    
    // Validate secret strength in production
    if (sessionSecret.length < 32) {
        console.error('❌ SECURITY ERROR: SESSION_SECRET must be at least 32 characters long!');
        console.error('   Current length:', sessionSecret.length);
        console.error('   Please set a longer, random SESSION_SECRET in your .env file.');
        process.exit(1);
    }
} else {
    // Development mode: Show warning but allow server to start
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
        console.warn('⚠️  SECURITY WARNING: Using default SESSION_SECRET!');
        console.warn('   This is insecure and should NOT be used in production!');
        console.warn('   Please set a strong, random SESSION_SECRET in your .env file.');
        console.warn('   Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    } else if (sessionSecret.length < 32) {
        console.warn('⚠️  SECURITY WARNING: SESSION_SECRET should be at least 32 characters long!');
        console.warn('   Current length:', sessionSecret.length);
    }
}

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        // Only set secure flag when explicitly using HTTPS (via USE_HTTPS env var)
        // This allows HTTP in development and HTTPS in production
        secure: process.env.USE_HTTPS === 'true',
        httpOnly: true, // Prevent XSS access to cookies
        sameSite: 'lax', // More compatible than 'strict' - works with redirects and cross-site scenarios
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport session serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { get } = require('./config/database');
        const user = await get('SELECT * FROM users WHERE id = ?', [id]);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Discord OAuth Strategy
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
        scope: ['identify', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const { get, run } = require('./config/database');
            
            // Check if this is a linking operation (user is already logged in)
            // This will be checked in the callback route using session
            
            // Check if user exists with this Discord ID
            let user = await get('SELECT * FROM users WHERE discord_id = ?', [profile.id]);
            
            if (user) {
                // BUGFIX #11: User exists with this Discord ID - update username/email if changed
                // Discord users may change their username or email, so we should keep our records in sync
                const updates = [];
                const params = [];
                
                // Update username if changed (and user doesn't have a password - i.e., is a Discord-only user)
                if (profile.username && profile.username !== user.username && !user.password) {
                    updates.push('username = ?');
                    params.push(profile.username);
                }
                
                // Update email if changed and provided
                if (profile.email && profile.email !== user.email) {
                    updates.push('email = ?');
                    params.push(profile.email);
                }
                
                if (updates.length > 0) {
                    params.push(user.id);
                    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
                    // Refresh user data
                    user = await get('SELECT * FROM users WHERE id = ?', [user.id]);
                }
                
                return done(null, user);
            }
            
            // Check if user exists with this email (for auto-linking)
            user = await get('SELECT * FROM users WHERE email = ?', [profile.email]);
            
            if (user) {
                // Link Discord account to existing account by email
                await run('UPDATE users SET discord_id = ? WHERE id = ?', [profile.id, user.id]);
                user.discord_id = profile.id;
                return done(null, user);
            }
            
            // Create new user (only if not linking to existing account)
            const result = await run(
                'INSERT INTO users (username, email, discord_id, password, coins) VALUES (?, ?, ?, ?, ?)',
                [profile.username, profile.email, profile.id, '', 0] // Empty password for Discord users
            );
            
            user = await get('SELECT * FROM users WHERE id = ?', [result.lastID]);
            
            // Auto-create Pterodactyl user if configured
            try {
                const pterodactyl = require('./config/pterodactyl');
                const isConfigured = await pterodactyl.isConfigured();
                if (isConfigured) {
                    // Check if user already exists in Pterodactyl
                    const existingUser = await pterodactyl.getPterodactylUserByEmail(profile.email);
                    
                    if (!existingUser.success) {
                        // Create new user in Pterodactyl
                        const names = profile.username.split(' ');
                        const firstName = names[0] || profile.username;
                        const lastName = names.slice(1).join(' ') || 'User';
                        
                        // Generate a random password for Pterodactyl (user will need to reset it)
                        const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
                        
                        const pterodactylUser = await pterodactyl.createPterodactylUser({
                            email: profile.email,
                            username: profile.username,
                            first_name: firstName,
                            last_name: lastName,
                            password: randomPassword
                        });
                        
                        if (pterodactylUser.success && pterodactylUser.data) {
                            const pterodactylUserId = pterodactylUser.data.id || pterodactylUser.data.attributes?.id;
                            // Update user with Pterodactyl user ID
                            await run('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', 
                                [pterodactylUserId, user.id]);
                            user.pterodactyl_user_id = pterodactylUserId;
                        }
                    } else {
                        // User already exists, use existing ID
                        const pterodactylUserId = existingUser.data.id || existingUser.data.attributes?.id;
                        await run('UPDATE users SET pterodactyl_user_id = ? WHERE id = ?', 
                            [pterodactylUserId, user.id]);
                        user.pterodactyl_user_id = pterodactylUserId;
                    }
                }
            } catch (error) {
                console.error('Error creating Pterodactyl user for Discord signup:', error);
                // Don't fail signup if Pterodactyl creation fails
            }
            
            return done(null, user);
            
        } catch (error) {
            return done(error, null);
        }
    }));
} else {
    console.log('⚠️  Discord OAuth not configured. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env file');
}

// Serve static files (CSS, JavaScript, images)
// Files in the 'public' folder can be accessed directly
app.use(express.static(path.join(__dirname, 'public')));

// We'll serve HTML files directly from the views folder
// No need for a template engine - we'll use simple HTML files

// Initialize database
// This will create all tables if they don't exist
require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const serverRoutes = require('./routes/servers');
const linkvertiseRoutes = require('./routes/linkvertise');
const communityRoutes = require('./routes/community');
const adminRoutes = require('./routes/admin');
const dailyRewardRoutes = require('./routes/dailyReward');
const adminV15Routes = require('./routes/adminV15');
const referralRoutes = require('./routes/referral');
const activityRoutes = require('./routes/activity');
const notificationsRoutes = require('./routes/notifications');
const onboardingRoutes = require('./routes/onboarding');
const { maintenanceStatusHandler } = require('./routes/maintenance');
const discordRoutes = require('./routes/discord');
const botRoutes = require('./routes/bot');

// Use routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/servers', serverRoutes);
app.use('/linkvertise', linkvertiseRoutes);
app.use('/community', communityRoutes);
app.use('/daily-reward', dailyRewardRoutes);
app.use('/admin/api/v15', adminV15Routes);
app.use('/referral', referralRoutes);
app.use('/activity', activityRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/admin', adminRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/invites', communityRoutes); // Mount invites routes

// Health check endpoint - for monitoring and Cloudflare health checks
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Public maintenance status (no auth)
app.get('/maintenance/api/status', maintenanceStatusHandler);

// Home route - redirect to login if not authenticated, otherwise to dashboard
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/auth/login');
    }
});

// Error handling middleware (should be last)
app.use((err, req, res, next) => {
    console.error('Error:', err);
    console.error('Error stack:', err.stack);
    
    // Don't send response if headers already sent
    if (!res.headersSent) {
        res.status(500).json({ 
            success: false, 
            message: 'An internal error occurred' 
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.IO with CORS support
const io = new Server(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

// Make Socket.IO instance available to routes via app
app.set('io', io);

// Initialize status poller with Socket.IO instance (Phase 3)
const statusPoller = require('./config/statusPoller');
statusPoller.initialize(io);

// Record health timeline snapshots periodically
try {
    const healthPoller = require('./config/healthPoller');
    healthPoller.start();
} catch (e) {
    console.error('[healthPoller] Failed to start:', e);
}

// Minimal WebSocket connection handler (Phase 1 + Phase 2 + Phase 3)
io.on('connection', (socket) => {
    console.log('[WebSocket] Client connected:', socket.id);

    socket.on('join_user_room', (data) => {
        if (data && data.userId) {
            socket.join('user:' + data.userId);
        }
    });

    // Phase 2: Server subscription events
    socket.on('subscribe_server', async (data) => {
        console.log('[WebSocket] Subscription request:', data);

        if (!data || !data.serverId) {
            console.log('[WebSocket] Invalid subscription request');
            return;
        }

        const room = `server:${data.serverId}`;
        socket.join(room);

        console.log(`[WebSocket] Socket ${socket.id} joined room ${room}`);
        
        // Phase 3: Subscribe to status poller
        // Get userId from session (socket.request.session is available via session middleware)
        // We'll get it from the database by looking up the server owner
        try {
            const { get } = require('./config/database');
            const server = await get('SELECT user_id FROM servers WHERE id = ?', [data.serverId]);
            if (server && server.user_id) {
                await statusPoller.subscribeSocketToServer(socket.id, data.serverId, server.user_id);
            }
        } catch (error) {
            console.error('[WebSocket] Error subscribing to status poller:', error);
        }
        
        // Send confirmation back to client
        socket.emit('subscribed', { serverId: data.serverId });
    });

    socket.on('unsubscribe_server', (data) => {
        if (!data || !data.serverId) return;

        const room = `server:${data.serverId}`;
        socket.leave(room);

        // Phase 3: Unsubscribe from status poller
        statusPoller.unsubscribeSocketFromServer(socket.id, data.serverId);

        console.log(`[WebSocket] Socket ${socket.id} left room ${room}`);
    });

    socket.on('disconnect', () => {
        console.log('[WebSocket] Client disconnected:', socket.id);
        
        // Phase 3: Unsubscribe from all servers on disconnect
        statusPoller.unsubscribeSocketFromAll(socket.id);
    });
});

// Start the server
// Bind to 0.0.0.0 to allow connections from all network interfaces
// This works for both development (localhost) and production (external IP)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Aether Dashboard is running on http://0.0.0.0:${PORT}`);
    console.log(`📝 Access locally: http://localhost:${PORT}`);
    console.log(`📝 WebSocket support enabled on ws://localhost:${PORT}`);
    console.log(`📝 Make sure to set up your .env file with required configuration`);
});


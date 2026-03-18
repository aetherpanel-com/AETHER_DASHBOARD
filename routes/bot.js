// Bot Status Routes
// Handles Discord bot heartbeat and status checking

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');

// Bot heartbeat tracking
// Stores the timestamp of the last heartbeat received from the bot
let botLastHeartbeat = null;

// Middleware to verify bot API key from x-api-key header (for heartbeat)
function verifyBotApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.BOT_API_KEY;
    
    // Check if x-api-key header exists
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Missing x-api-key header'
        });
    }
    
    // Verify API key matches BOT_API_KEY
    if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid API key'
        });
    }
    
    // Authentication successful
    next();
}

// POST /api/bot/heartbeat
// Endpoint for Discord bot to send heartbeat signals
router.post('/heartbeat', verifyBotApiKey, (req, res) => {
    try {
        // Update last heartbeat timestamp
        botLastHeartbeat = Date.now();
        
        // Return success response
        res.json({
            status: 'ok'
        });
    } catch (error) {
        console.error('Error processing bot heartbeat:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/bot/status
// Endpoint to check if Discord bot is online
router.get('/status', requireAdmin, (req, res) => {
    try {
        const now = Date.now();
        const heartbeatTimeout = 60000; // 60 seconds
        
        // Check if heartbeat exists and is within timeout window
        if (botLastHeartbeat && (now - botLastHeartbeat) < heartbeatTimeout) {
            res.json({
                online: true
            });
        } else {
            res.json({
                online: false
            });
        }
    } catch (error) {
        console.error('Error checking bot status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;

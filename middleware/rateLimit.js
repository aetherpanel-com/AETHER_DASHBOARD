// Rate Limiting Middleware
// Prevents abuse by limiting the number of requests per IP address

const rateLimit = require('express-rate-limit');

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Skip rate limiting for admin users on admin endpoints
        return req.session?.user?.is_admin && req.path.startsWith('/admin');
    }
});

// Authentication rate limiter - 5 requests per 15 minutes (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login/signup attempts per windowMs
    message: {
        success: false,
        message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful requests
});

// Server creation rate limiter - 10 requests per hour
const serverCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 server creations per hour
    message: {
        success: false,
        message: 'Too many server creation attempts. Please wait before creating another server.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Linkvertise completion rate limiter - 20 requests per 5 minutes
const linkvertiseLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // Limit each IP to 20 link completions per 5 minutes
    message: {
        success: false,
        message: 'Too many link completion attempts. Please wait a moment.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Purchase rate limiter - 30 requests per 10 minutes
const purchaseLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30, // Limit each IP to 30 purchases per 10 minutes
    message: {
        success: false,
        message: 'Too many purchase attempts. Please wait before making another purchase.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Renewal action limiter - prevent rapid renew spam/races
const renewalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 8, // generous for normal UI retries, strict enough for abuse
    message: {
        success: false,
        message: 'Too many renewal attempts. Please wait a moment.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    apiLimiter,
    authLimiter,
    serverCreationLimiter,
    linkvertiseLimiter,
    purchaseLimiter,
    renewalLimiter
};

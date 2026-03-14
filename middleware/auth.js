// Authentication Middleware
// Checks if user is logged in

const requireAuth = (req, res, next) => {
    // Check if user session exists
    if (!req.session.user) {
        // If not logged in, redirect to login page
        return res.redirect('/auth/login');
    }
    // User is logged in, continue to next middleware/route
    next();
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
    // First check if user is logged in
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    // Then check if user is admin
    if (!req.session.user.is_admin) {
        return res.status(403).send('Access denied. Admin privileges required.');
    }
    next();
};

module.exports = {
    requireAuth,
    requireAdmin
};


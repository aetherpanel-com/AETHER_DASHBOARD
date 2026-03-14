// Input Validation Middleware
// Sanitizes and validates user input

// Basic input sanitization
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Remove potentially dangerous characters
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and >
        .substring(0, 255); // Limit length
}

// Validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate username (alphanumeric and underscores, 3-20 chars)
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

// Middleware to sanitize request body
function sanitizeBody(req, res, next) {
    if (req.body) {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeInput(req.body[key]);
            }
        }
    }
    next();
}

// Validate signup data
function validateSignup(req, res, next) {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'All fields are required' 
        });
    }
    
    if (!isValidUsername(username)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' 
        });
    }
    
    if (!isValidEmail(email)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid email address' 
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Password must be at least 6 characters long' 
        });
    }
    
    next();
}

// Validate login data
function validateLogin(req, res, next) {
    const { usernameOrEmail, password } = req.body;
    
    if (!usernameOrEmail || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username/Email and password are required' 
        });
    }
    
    // Username or email is acceptable, so we don't validate format here
    // The backend will check if it matches either username or email
    
    next();
}

module.exports = {
    sanitizeInput,
    isValidEmail,
    isValidUsername,
    sanitizeBody,
    validateSignup,
    validateLogin
};


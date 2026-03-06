// Encryption Helper Functions
// Used for encrypting sensitive data like API keys

const crypto = require('crypto');

// Get encryption key from environment variable
// Use SESSION_SECRET as the encryption key (or generate a hash from it)
// Note: SESSION_SECRET is validated in server.js - this should only be called if server started successfully
function getEncryptionKey() {
    // In production, SESSION_SECRET is required by server.js, so it should exist
    // In development, use a default but it's not secure
    const secret = process.env.SESSION_SECRET || 'default-secret-key-change-this';
    // Create a 32-byte key from the secret using SHA-256
    return crypto.createHash('sha256').update(secret).digest();
}

// Encrypt text using AES-256-CBC
function encrypt(text) {
    if (!text) return null;
    
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(16); // Initialization vector
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Prepend IV to encrypted data (IV doesn't need to be secret)
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

// Decrypt text using AES-256-CBC
function decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    try {
        const key = getEncryptionKey();
        const parts = encryptedText.split(':');
        
        if (parts.length !== 2) {
            // If format is wrong, might be unencrypted (for migration)
            return encryptedText;
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        // If decryption fails, might be unencrypted (for migration)
        return encryptedText;
    }
}

module.exports = {
    encrypt,
    decrypt
};


function generatePanelPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 12; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)];
    }
    return pass;
}

/**
 * Sanitize a username to meet Pterodactyl's username validation rules.
 * - Strip all characters except letters, numbers, underscores, hyphens, periods
 * - Strip leading and trailing special characters (. _ -)
 * - Enforce minimum length of 6 by padding with random digits if needed
 * - Enforce maximum length of 20 by truncating
 * - If result is empty after stripping, generate a fallback username
 *
 * @param {string} username - Raw username (e.g. from Discord)
 * @returns {string} - Pterodactyl-safe username
 */
function sanitizePterodactylUsername(username) {
    if (!username) return `user_${Math.floor(Math.random() * 100000)}`;

    // Step 1: Strip all disallowed characters
    let sanitized = username.replace(/[^a-zA-Z0-9_\-\.]/g, '');

    // Step 2: Strip leading and trailing special characters
    sanitized = sanitized.replace(/^[_\-\.]+|[_\-\.]+$/g, '');

    // Step 3: Truncate to 20 characters
    sanitized = sanitized.substring(0, 20);

    // Step 4: Strip trailing special chars again after truncation
    sanitized = sanitized.replace(/[_\-\.]+$/g, '');

    // Step 5: If too short (< 6 chars), pad with random digits
    if (sanitized.length < 6) {
        const padding = Math.floor(Math.random() * 100000).toString();
        sanitized = (sanitized + padding).substring(0, 20);
    }

    // Step 6: Final fallback if still empty
    if (!sanitized || sanitized.length < 6) {
        sanitized = `user_${Math.floor(Math.random() * 100000)}`;
    }

    return sanitized;
}

module.exports = {
    generatePanelPassword,
    sanitizePterodactylUsername
};

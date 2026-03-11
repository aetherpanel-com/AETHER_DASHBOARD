#!/usr/bin/env node

/**
 * Aether Dashboard - Admin Password Reset Script
 * 
 * This script allows you to reset the admin password if you forget it.
 * It only resets the password - it does NOT delete any data!
 * 
 * Usage:
 *   node reset-admin-password.js "your-new-password"
 * 
 * Example:
 *   node reset-admin-password.js "mypassword123"
 */

const bcrypt = require('bcrypt');
const { get, run } = require('./config/database');

// Get new password from command line argument
const newPassword = process.argv[2];

// Check if password was provided
if (!newPassword) {
    console.error('❌ Error: Please provide a new password!');
    console.log('');
    console.log('Usage:');
    console.log('  node reset-admin-password.js "your-new-password"');
    console.log('');
    console.log('Example:');
    console.log('  node reset-admin-password.js "mypassword123"');
    process.exit(1);
}

// Check password length
if (newPassword.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long!');
    process.exit(1);
}

// Main function
async function resetAdminPassword() {
    try {
        console.log('🔄 Resetting admin password...');
        console.log('');
        
        // Check if admin user exists
        const admin = await get('SELECT id, username FROM users WHERE username = ? AND is_admin = 1', ['admin']);
        
        if (!admin) {
            console.error('❌ Error: Admin user not found!');
            console.log('   Make sure the dashboard has been set up and an admin account exists.');
            process.exit(1);
        }
        
        // Hash the new password
        console.log('🔐 Hashing new password...');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update the password in database
        console.log('💾 Updating password in database...');
        await run('UPDATE users SET password = ? WHERE username = ? AND is_admin = 1', [hashedPassword, 'admin']);
        
        console.log('');
        console.log('✅ Admin password reset successfully!');
        console.log('');
        console.log('📝 Login Details:');
        console.log('   Username: admin');
        console.log(`   Password: ${newPassword}`);
        console.log('');
        console.log('⚠️  Important:');
        console.log('   - Remember to save this password in a safe place!');
        console.log('   - You can now log in to the dashboard with these credentials.');
        console.log('');
        console.log('💡 Tip: If the dashboard is running, you may need to restart it:');
        console.log('   pm2 restart aether-dashboard');
        console.log('');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting password:', error.message);
        console.error('');
        console.error('Troubleshooting:');
        console.error('  1. Make sure you are in the AETHER_DASHBOARD directory');
        console.error('  2. Make sure the database file (database.db) exists');
        console.error('  3. Check that Node.js and all dependencies are installed');
        console.error('  4. Make sure the dashboard is not currently running (or restart it after)');
        process.exit(1);
    }
}

// Run the function
resetAdminPassword();


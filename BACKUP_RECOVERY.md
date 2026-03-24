# Database Backup & Recovery Guide

**How to backup and restore your `database.db` file to prevent data loss!**

---

## 📝 Note About Server Backups (Version 1.3+)

**This guide is for DASHBOARD backups** (your `database.db` file).

**Version 1.5.0 note:** v1.5 adds several new database tables (notifications, daily_reward_config, referral_config, etc.) that are created automatically on startup. Your normal `database.db` and `.env` backup routine is still valid before updating. No additional files need to be backed up.
**Version 1.5.3 note:** v1.5.3 adds the `activity_logs` table and a `log_retention_days` column to `feature_flags`. Both are created automatically on startup. No additional files need to be backed up — audit logs are stored in your existing `database.db` file.

**For GAME SERVER backups**, use the new Backup System feature:
1. Go to any server → Click "📊 Live Stats"
2. Scroll down to "Backup System" section
3. Click "Create Backup" to backup your game server files

The Backup System in v1.3+ lets users backup their game servers directly from the dashboard!

---

## ⚠️ Why Backups Are Important

Your `database.db` file contains **ALL** your dashboard data:
- User accounts and passwords
- Server configurations
- Coins and purchases
- Linkvertise links and completions
- Admin settings and configurations
- Pterodactyl panel settings

**If this file is lost or corrupted, you lose everything!** Always keep backups!

---

## 📦 How to Create Backups

### Manual Backup (One-Time)

**Step 1: Connect to your VPS via SSH**

**Step 2: Go to your dashboard folder:**
```bash
cd AETHER_DASHBOARD
```

**Step 3: Create a backup folder (if it doesn't exist):**
```bash
mkdir -p backups
```

**Step 4: Create a backup:**
```bash
cp database.db backups/database-$(date +%Y%m%d-%H%M%S).db
```

**What this does:**
- Creates a copy of your database file
- Names it with the current date and time (e.g., `database-20240105-143045.db`)
- Stores it in the `backups/` folder

**✅ Backup created!** You can see it with:
```bash
ls -la backups/
```

---

## 🔄 Automatic Backups (Recommended)

**Set up automatic daily backups so you never forget!**

### Option 1: Using Cron (Linux)

**Step 1: Open the crontab editor:**
```bash
crontab -e
```

**Step 2: Add this line at the end of the file:**
```bash
# Backup database daily at 2 AM
0 2 * * * cd /root/AETHER_DASHBOARD && mkdir -p backups && cp database.db backups/database-$(date +\%Y\%m\%d-\%H\%M\%S).db && find backups/ -name "database-*.db" -mtime +7 -delete
```

**Replace `/root/AETHER_DASHBOARD` with your actual dashboard path!**

**What this does:**
- Runs every day at 2 AM
- Creates a backup with timestamp
- Keeps only the last 7 days of backups (deletes older ones)
- Saves disk space automatically

**Step 3: Save and exit:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter`

**✅ Automatic backups are now set up!**

### Option 2: Manual Script

**Create a backup script:**

**Step 1: Create the script file:**
```bash
nano backup-database.sh
```

**Step 2: Paste this content:**
```bash
#!/bin/bash
# Database backup script for Aether Dashboard

# Change to dashboard directory
cd /root/AETHER_DASHBOARD

# Create backups folder if it doesn't exist
mkdir -p backups

# Create backup with timestamp
cp database.db backups/database-$(date +%Y%m%d-%H%M%S).db

# Keep only last 7 days of backups
find backups/ -name "database-*.db" -mtime +7 -delete

echo "✅ Backup created successfully!"
```

**Replace `/root/AETHER_DASHBOARD` with your actual dashboard path!**

**Step 3: Make it executable:**
```bash
chmod +x backup-database.sh
```

**Step 4: Run it manually whenever you want:**
```bash
./backup-database.sh
```

**Or add it to cron for automatic backups:**
```bash
crontab -e
# Add this line:
0 2 * * * /root/AETHER_DASHBOARD/backup-database.sh
```

---

## 🔍 How to List Your Backups

**See all your backups:**
```bash
cd AETHER_DASHBOARD
ls -lh backups/
```

**This shows:**
- All backup files
- Their sizes
- Creation dates

**Example output:**
```
-rw-r--r-- 1 root root 1.2M Jan  5 14:30 database-20240105-143045.db
-rw-r--r-- 1 root root 1.3M Jan  6 14:30 database-20240106-143045.db
-rw-r--r-- 1 root root 1.4M Jan  7 14:30 database-20240107-143045.db
```

---

## 🔄 How to Restore from Backup

**If you accidentally deleted `database.db` or need to restore old data:**

### Step 1: Stop the Dashboard

**Stop the dashboard first:**
```bash
pm2 stop aether-dashboard
```

**⚠️ IMPORTANT:** Always stop the dashboard before restoring!

### Step 2: List Your Backups

**See what backups you have:**
```bash
cd AETHER_DASHBOARD
ls -la backups/
```

**Find the backup you want to restore** (usually the most recent one)

### Step 3: Restore the Backup

**Copy the backup back to the main location:**
```bash
cp backups/database-YYYYMMDD-HHMMSS.db database.db
```

**Replace `YYYYMMDD-HHMMSS` with your backup filename!**

**Example:**
```bash
cp backups/database-20240107-143045.db database.db
```

### Step 4: Set Correct Permissions

**Make sure the file has correct permissions:**
```bash
chmod 644 database.db
```

### Step 5: Restart the Dashboard

**Start the dashboard again:**
```bash
pm2 restart aether-dashboard
```

### Step 6: Verify Everything Works

**Check the logs:**
```bash
pm2 logs aether-dashboard --lines 20
```

**Log in to your dashboard** and verify:
- ✅ All users are there
- ✅ All servers are there
- ✅ Settings are correct
- ✅ Coins and purchases are intact

**✅ Data restored successfully!**

---

## 🚨 What If I Don't Have a Backup?

**If you deleted `database.db` and don't have a backup:**

### The Bad News:
- ❌ **All data is lost** (users, servers, coins, settings)
- ❌ **Cannot recover** without a backup

### The Good News:
- ✅ **Dashboard will recreate itself** automatically
- ✅ **You can start fresh** with default settings

### What to Do:

**Step 1: Restart the dashboard:**
```bash
pm2 restart aether-dashboard
```

**Step 2: The database will be recreated automatically:**
- New empty `database.db` file
- All tables created (empty)
- Default admin user created:
  - Username: `admin`
  - Password: `admin123`

**Step 3: Start over:**
- Log in with default admin credentials
- Reconfigure everything:
  - Linkvertise settings
  - Resource prices
  - Pterodactyl connection
  - Branding settings
- Users need to sign up again

**⚠️ This is why backups are so important!**

---

## 📋 Backup Best Practices

### 1. **Backup Frequency**
- **Daily backups** - Recommended for production
- **Before updates** - Always backup before updating
- **Before major changes** - Backup before making big changes

### 2. **Backup Storage**
- **Keep backups on the server** - Quick access
- **Download backups** - Keep copies on your computer too
- **Multiple locations** - Don't keep all backups in one place

### 3. **Backup Retention**
- **Keep last 7 days** - Daily backups
- **Keep weekly backups** - For longer retention
- **Keep monthly backups** - For long-term recovery

### 4. **Test Your Backups**
- **Test restore** - Periodically test restoring from backup
- **Verify data** - Make sure backups contain correct data
- **Check file size** - Ensure backups aren't corrupted

### 5. **Backup Both Files**
- **`database.db`** - Your data
- **`.env`** - Your configuration

**Backup both together:**
```bash
mkdir -p backups
cp database.db backups/database-$(date +%Y%m%d-%H%M%S).db
cp .env backups/.env-$(date +%Y%m%d-%H%M%S)
```

---

## 🔧 Advanced: Download Backups to Your Computer

**Keep backups on your computer for extra safety:**

### Using SFTP (FileZilla)

**Step 1: Connect to your VPS with FileZilla**

**Step 2: Navigate to:**
- Remote: `/root/AETHER_DASHBOARD/backups/`
- Local: Your computer's backup folder

**Step 3: Download backup files:**
- Right-click on backup file
- Select "Download"
- Save to your computer

### Using SCP (Command Line)

**From your computer:**
```bash
scp username@your-vps-ip:/root/AETHER_DASHBOARD/backups/database-*.db /path/to/local/backups/
```

**Replace:**
- `username` with your VPS username
- `your-vps-ip` with your VPS IP address
- `/path/to/local/backups/` with where you want to save on your computer

---

## ❓ Troubleshooting

### "Permission denied" when creating backup

**Fix:**
```bash
chmod 755 backups/
chmod 644 database.db
```

### "No space left on device"

**Fix:**
- Delete old backups: `find backups/ -name "database-*.db" -mtime +7 -delete`
- Check disk space: `df -h`
- Clean up old files

### "Backup file is 0 bytes"

**Problem:** Database file might be locked or corrupted

**Fix:**
1. Stop dashboard: `pm2 stop aether-dashboard`
2. Wait a few seconds
3. Try backup again: `cp database.db backups/database-$(date +%Y%m%d-%H%M%S).db`
4. Restart dashboard: `pm2 restart aether-dashboard`

### "Cannot restore backup - file not found"

**Check:**
1. Are you in the right folder? `pwd` should show `/root/AETHER_DASHBOARD`
2. List backups: `ls -la backups/`
3. Check filename spelling (case-sensitive!)

---

## 📝 Quick Reference

### Create Backup
```bash
cd AETHER_DASHBOARD
mkdir -p backups
cp database.db backups/database-$(date +%Y%m%d-%H%M%S).db
```

### List Backups
```bash
ls -lh backups/
```

### Restore Backup
```bash
pm2 stop aether-dashboard
cp backups/database-YYYYMMDD-HHMMSS.db database.db
pm2 restart aether-dashboard
```

### Automatic Daily Backup (Cron)
```bash
crontab -e
# Add: 0 2 * * * cd /root/AETHER_DASHBOARD && mkdir -p backups && cp database.db backups/database-$(date +\%Y\%m\%d-\%H\%M\%S).db && find backups/ -name "database-*.db" -mtime +7 -delete
```

---

## 💡 Tips

1. **Backup before updates** - Always backup before updating the dashboard
2. **Test backups** - Periodically test restoring from backup
3. **Multiple locations** - Keep backups on server AND your computer
4. **Document backups** - Note when you created backups
5. **Monitor disk space** - Don't let backups fill up your disk

---

**Last Updated:** Version 1.5.7

**Made with ❤️ for free hosting providers**


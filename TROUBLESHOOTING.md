# Troubleshooting Guide

**Common issues and solutions for Aether Dashboard**

---

## 🔧 Installation Issues

### "Installer script fails to run"

**Problem:** Cannot execute the installer script.

**Solution:**

1. **Ensure you have root access:**
   ```bash
   sudo bash install.sh
   ```

2. **Check if script is executable:**
   ```bash
   chmod +x install.sh
   sudo ./install.sh
   ```

3. **Download script manually if curl fails:**
   ```bash
   wget https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/install.sh
   sudo bash install.sh
   ```

---

### "DNS verification timeout during installation"

**Problem:** Installer waits for DNS but it never resolves.

**Solution:**

1. **Check DNS configuration:**
   ```bash
   dig +short your-domain.com
   ```

2. **Verify DNS is pointing to correct IP:**
   - Check your DNS provider's control panel
   - Ensure A record is created correctly
   - Wait up to 48 hours for full propagation

3. **Skip DNS verification (not recommended):**
   - Press Ctrl+C when prompted
   - Continue with installation
   - Configure SSL manually later using `certbot`

---

### "SSL certificate installation fails"

**Problem:** Certbot fails to obtain SSL certificate during installation.

**Checklist:**
- ✅ DNS is properly configured and pointing to server IP
- ✅ Port 80 is open and accessible
- ✅ Nginx is running
- ✅ Domain is not already using a certificate

**Fix:**

1. **Run certbot manually:**
   ```bash
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

2. **Check Nginx configuration:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

### "PM2 services not starting after installation"

**Problem:** Dashboard or Discord bot fails to start.

**Checklist:**
- ✅ Check PM2 logs: `pm2 logs`
- ✅ Verify .env files exist and are configured
- ✅ Check Node.js version: `node --version` (should be 18+)
- ✅ Verify dependencies installed: `cd /opt/aether-dashboard && npm list`

**Fix:**

1. **Check service status:**
   ```bash
   pm2 status
   pm2 logs aether-dashboard
   ```

2. **Restart services:**
   ```bash
   pm2 restart aether-dashboard
   pm2 restart aether-discord-bot
   ```

3. **Reinstall dependencies if needed:**
   ```bash
   cd /opt/aether-dashboard
   npm install
   cd aether-discord-bot
   npm install
   ```

---

### "Update script fails"

**Problem:** Update script shows errors or doesn't complete.

**Solution:**

1. **Check installation directory exists:**
   ```bash
   ls -la /opt/aether-dashboard
   ```

2. **Verify git repository:**
   ```bash
   cd /opt/aether-dashboard
   git status
   ```

3. **Manual update:**
   ```bash
   cd /opt/aether-dashboard
   git pull origin main
   npm install
   cd aether-discord-bot && npm install && cd ..
   pm2 restart aether-dashboard
   pm2 restart aether-discord-bot
   ```

---

## ❓ Common Issues

### "node: command not found"

**Problem:** Node.js isn't installed correctly.

**Solution:**
1. Go back to Step 3 (Install Node.js) in the [Installation Guide](README.md#step-3-install-nodejs)
2. Make sure you followed all the steps
3. Try running the installation commands again
4. After installing, close and reopen your SSH connection

---

### "Port 3000 is already in use"

**Problem:** Something else is using port 3000.

**Solution:**

**Option 1:** Change the port in `.env` file:
```bash
nano .env
```
Change `PORT=3000` to `PORT=3001`
Save and restart: `pm2 restart aether-dashboard`

**Option 2:** Find what's using port 3000:
```bash
sudo lsof -i :3000
```
Stop that process

---

### "Server shows raw IP instead of my subdomain"

**Problem:** The server address is showing a raw IP like `1.2.3.4:25565` instead of your preferred subdomain.

**Checklist:**
- ✅ The allocation has an `ip_alias` configured in the Pterodactyl admin panel
- ✅ Allocations were synced from `Admin Panel -> Panel`
- ✅ You reopened the server details page so the dashboard could re-resolve the address

**Fix:**

1. **Set `ip_alias` in Pterodactyl:**
   - Go to `Nodes -> Allocations`
   - Edit the allocation and set the alias/subdomain you want users to see

2. **Sync allocations into the dashboard:**
   - Open `Admin Panel -> Panel`
   - Fetch and sync allocations so the local `pterodactyl_allocations` table stores the alias

3. **Reload the server details page:**
   - Existing servers can refresh and cache the alias-based address the next time their details page is opened

---

### "Server is stuck on Installing or uptime never changes"

**Problem:** The server status stays on `Installing` / `Checking...`, or uptime does not update as expected.

**Expected behavior in v1.4.3:**
- `installing` = the server is still being provisioned by Pterodactyl
- `checking` = a temporary API issue while retrying
- `unknown` = treated as **Offline**, not still installing

**Fix:**

1. **Wait for the install script to finish** if the server was just created.
2. **Check the server directly in Pterodactyl** to confirm whether it is `offline`, `running`, or still installing.
3. **Check dashboard logs:**
   ```bash
   pm2 logs aether-dashboard --lines 100
   ```
4. **If the server is ready but never started:**
   - Refresh the details page
   - It should now show **Offline** with an offline uptime message
5. **If you keep seeing `Checking...`:**
   - Verify your Pterodactyl URL and API keys in `Admin Panel -> Panel`
   - Confirm the panel is reachable from the VPS

---

### "Cannot access dashboard from browser"

**Check these things:**

1. **Is the dashboard running?**
   ```bash
   pm2 list
   ```
   You should see `aether-dashboard` with status `online`

2. **Check the logs:**
   ```bash
   pm2 logs aether-dashboard
   ```
   Look for errors (red text)

3. **Test from the VPS itself:**
   ```bash
   curl http://localhost:3000
   ```
   If this works, the problem is with firewall or network

4. **Check firewall:**
   - Make sure you completed Step 8 (Configure Firewall) in the [Installation Guide](README.md#step-8-configure-firewall)
   - Check cloud provider firewall (DigitalOcean, AWS, etc.)

5. **Check if port is open:**
   - Use an online tool: https://www.yougetsignal.com/tools/open-ports/
   - Enter your VPS IP and port 3000

---

### "Login redirects back to login page"

**This is usually a session/cookie issue:**

1. **Check your `.env` file:**
   ```bash
   nano .env
   ```
   - If using HTTPS, make sure `USE_HTTPS=true`
   - If using HTTP, make sure `USE_HTTPS=false`
   - Save and restart: `pm2 restart aether-dashboard`

2. **If using Nginx, check the configuration:**
   - Make sure all the proxy headers are set (see Nginx setup in [README.md](README.md#step-3-create-nginx-configuration))
   - Test config: `sudo nginx -t`
   - Reload: `sudo systemctl reload nginx`

3. **Check server logs:**
   ```bash
   pm2 logs aether-dashboard
   ```
   Look for any errors

---

### "Linkvertise not giving coins"

**Checklist:**
- ✅ Linkvertise configuration is saved in `Admin Panel -> Integrations -> Linkvertise`
- ✅ Link is marked as "Active" in Admin Panel
- ✅ Cooldown timer has expired (if applicable)
- ✅ Ensure you haven't exceeded the "Max Completions per Window" limit configured by the admin (v1.5.6+)
- ✅ (v1.5.5+) Ensure your Linkvertise Target URL is configured exactly to your verification endpoint, e.g., `https://your-domain.com/linkvertise/verify/1`
- ✅ Check server logs: `pm2 logs aether-dashboard`

---

### "I forgot my admin password"

**Don't worry!** You can reset your admin password without losing any data.

**Easy Solution (Recommended):**

1. **Connect to your VPS via SSH** (same way you installed the dashboard)

2. **Go to your dashboard folder:**
   ```bash
   cd AETHER_DASHBOARD
   ```

3. **Run the password reset script:**
   ```bash
   node reset-admin-password.js "your-new-password-here"
   ```
   
   **Replace `your-new-password-here` with your desired password**
   
   **Example:**
   ```bash
   node reset-admin-password.js "mypassword123"
   ```

4. **You'll see a success message:**
   ```
   ✅ Admin password reset successfully!
   
   📝 Login Details:
      Username: admin
      Password: mypassword123
   ```

5. **Restart the dashboard (if it's running):**
   ```bash
   pm2 restart aether-dashboard
   ```

6. **Log in with your new password:**
   - Username: `admin`
   - Password: (the password you just set)

**✅ What this does:**
- Resets ONLY the admin password
- Keeps ALL your data (users, servers, settings, etc.)
- Safe and easy to use

**❌ What this does NOT do:**
- Does NOT delete any data
- Does NOT affect other users
- Does NOT change any settings

**⚠️ Important Notes:**
- Make sure to remember your new password!
- Save it in a safe place
- The password must be at least 6 characters long

**Alternative Method (Only if script doesn't work):**

If the script doesn't work for some reason, you can delete the database file (⚠️ **WARNING: This deletes ALL data!**):

1. **Delete the database file:**
   ```bash
   cd AETHER_DASHBOARD
   rm database.db
   ```

2. **Restart the dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

3. **This creates a new admin account:**
   - Username: `admin`
   - Password: `admin123`

4. **⚠️ You'll lose ALL your data** (users, servers, settings, etc.)

**We recommend using the password reset script instead!**

---

### "I accidentally deleted database.db"

**Don't panic!** Here's what to do:

**If you have a backup:**
1. Stop the dashboard: `pm2 stop aether-dashboard`
2. Restore from backup: `cp backups/database-YYYYMMDD-HHMMSS.db database.db`
3. Restart: `pm2 restart aether-dashboard`
4. ✅ Your data is restored!

**If you don't have a backup:**
1. Restart the dashboard: `pm2 restart aether-dashboard`
2. The database will be recreated automatically
3. ⚠️ **All data is lost** - you'll need to start over
4. Log in with default admin (username: `admin`, password: `admin123`)
5. Reconfigure everything

**💡 Prevention:** See the [Backup & Recovery Guide](BACKUP_RECOVERY.md) to set up automatic backups!

---

### "502 Bad Gateway" or "Service Unavailable"

**Problem:** Cloudflare or reverse proxy can't reach your backend server.

**Check these things:**

1. **Is the dashboard running?**
   ```bash
   pm2 list
   ```
   If not running, start it: `pm2 start server.js --name aether-dashboard`

2. **Check if the server crashed:**
   ```bash
   pm2 logs aether-dashboard --lines 50
   ```
   Look for errors or crashes

3. **Check server resources:**
   ```bash
   free -h  # Check memory
   df -h    # Check disk space
   ```

4. **Restart the dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

5. **If using Cloudflare:**
   - Check Cloudflare health check settings
   - Verify origin server is accessible
   - Check Cloudflare firewall rules

---

### "Error: Cannot find module"

**Problem:** Missing Node.js dependencies.

**Solution:**
```bash
cd AETHER_DASHBOARD
npm install
pm2 restart aether-dashboard
```

---

### "Database is locked" or "SQLite database locked"

**Problem:** Database file is being accessed by multiple processes or locked.

**Solution:**

1. **Stop the dashboard:**
   ```bash
   pm2 stop aether-dashboard
   ```

2. **Wait a few seconds**

3. **Check if any other process is using the database:**
   ```bash
   lsof database.db
   ```

4. **Restart the dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

---

### "Permission denied" errors

**Problem:** File permissions are incorrect.

**Solution:**

1. **Fix database file permissions:**
   ```bash
   chmod 644 database.db
   ```

2. **Fix folder permissions:**
   ```bash
   chmod 755 AETHER_DASHBOARD
   ```

3. **If using a non-root user, ensure they own the files:**
   ```bash
   sudo chown -R username:username AETHER_DASHBOARD
   ```

---

## 🚀 New Features Troubleshooting (Version 1.5)

### "Discord login fails or server creation fails with 422 error"

**Problem:** User's Discord username contains special characters that Pterodactyl does not accept, causing a validation error during sync.

**This is fixed in v1.5.4.** Update to the latest version:
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**If still occurring after update:**
- ✅ Check PM2 logs for a sanitization warning: `pm2 logs aether-dashboard | grep sanitized`
- ✅ If you see `[Pterodactyl] Username sanitized: "x" → "y"` the fix is working correctly
- ✅ If the sanitized result is still rejected, check if the Pterodactyl panel has custom username validation rules configured

---

### "Audit Logs page shows no entries"

**Checklist:**
- ✅ Actions must be performed **after** updating to v1.5.3 — existing historical activity is not backfilled
- ✅ Confirm the `activity_logs` table was created: check server logs on startup for migration messages
- ✅ Check dashboard logs: `pm2 logs aether-dashboard`

---

### "Audit log timestamps are showing wrong time"

**Expected behaviour:** Timestamps are stored in UTC and converted to your local timezone in the browser. Use the **Display Timezone** dropdown on the Audit Logs page to select your correct timezone if the auto-detected one is wrong.

---

### "Audit Logs not appearing in sidebar"

**Checklist:**
- ✅ You must be logged in as an admin — the Audit Logs link is only visible to admin accounts
- ✅ The link appears under Admin Panel → Admin Settings (expand the dropdown)
- ✅ Hard refresh the page (`Ctrl + Shift + R`) to clear any cached sidebar HTML

---

### "Daily rewards claim button does nothing"

**Checklist:**
- ✅ Daily Rewards feature is enabled in Admin Panel → Daily Rewards tab
- ✅ Reward amounts are configured and saved
- ✅ User has not already claimed today (banner shows "Come back tomorrow!")
- ✅ Check browser console for errors

**Fix:**
1. Verify feature is enabled in Admin Panel → Daily Rewards
2. Restart dashboard: `pm2 restart aether-dashboard`
3. Check logs: `pm2 logs aether-dashboard`

---

### "Invited user keeps rejoining but inviter stops getting coins"

**This is expected behaviour (abuse protection):**

After v1.5.2, a 24-hour cooldown is enforced between a user leaving and rejoining before a new reward is granted. This prevents join/leave farming.

- If the user left and rejoined **within 24 hours** → no reward, this is correct
- If the user left and rejoined **after 24 hours** → reward should be granted; check bot and dashboard logs if it is not

**Checklist:**
- ✅ Bot is running and connected: `pm2 logs aether-discord-bot`
- ✅ Dashboard is accessible from the bot
- ✅ `BOT_API_KEY` matches in both `.env` files
- ✅ Check dashboard logs: `pm2 logs aether-dashboard`

---

### "Deduct Per Leave is deducting the wrong amount"

**Checklist:**
- ✅ If **Deduct Per Leave** is set to `0` in Admin Panel → Integrations → Discord, the system deducts the exact coins that were awarded when the user joined (stored per-record)
- ✅ If you changed the **Reward per Invite** after a user already joined, the old reward amount is still what gets deducted (not the new setting) — this is correct behaviour
- ✅ If you set a fixed **Deduct Per Leave** value, that fixed amount is always deducted regardless of how much was awarded

---

### "Referral link not awarding coins"

**Checklist:**
- ✅ Referral System is enabled in Admin Panel → Referral tab
- ✅ Reward amounts are set (non-zero)
- ✅ New user signed up using the referral link (not an existing user)
- ✅ Same user cannot be referred twice

**Fix:**
1. Verify feature is enabled in Admin Panel → Referral
2. Confirm the new user used the correct referral link on the signup page
3. Check logs: `pm2 logs aether-dashboard`

---

### "Notification bell not showing on some pages"

**Checklist:**
- ✅ `notifications.js` script is loaded on the page
- ✅ `socket.io.js` is loaded before `notifications.js`
- ✅ Socket.IO connection is established (check browser console)

**Fix:**
- The bell requires both `notifications.js` and a Socket.IO connection on every page.
- Check the page's HTML for the required script tags in this order:
  1. `/socket.io/socket.io.js`
  2. `/js/main.js`
  3. `/js/dashboard.js`
  4. `/js/notifications.js`

---

### "Maintenance banner not appearing"

**Checklist:**
- ✅ Maintenance window is scheduled and active (current time is within start/end range)
- ✅ `maintenanceBanner.js` is loaded on the page
- ✅ Window has not been cancelled

**Fix:**
1. Check Admin Panel → Maintenance tab to confirm the window exists and is not cancelled
2. Verify the start/end times are correct (stored in UTC)
3. Confirm `maintenanceBanner.js` script tag is present in the page HTML

---

### "Broadcast sent but users don't see it"

**Checklist:**
- ✅ Users are online when broadcast is sent (live toast requires active Socket.IO connection)
- ✅ Offline users will see the broadcast in their notification bell on next page load
- ✅ Check that `notifications.js` is loaded on the page users are viewing

---

## 🚀 New Features Troubleshooting (Version 1.3+)

### "Discord bot not connecting" (Version 1.4+)

**Problem:** Discord bot shows errors or doesn't connect to Discord.

> **Note (v1.5.4+):** Discord usernames with special characters are automatically sanitized before being sent to Pterodactyl. The dashboard always displays the original Discord username.

**Checklist:**
- ✅ `DISCORD_BOT_TOKEN` is correct in bot `.env` file
- ✅ Bot has required intents enabled (Server Members, Message Content)
- ✅ Bot is invited to your Discord server with correct permissions
- ✅ Check bot logs: `pm2 logs aether-discord-bot`

**Fix:**
1. Verify bot token in Discord Developer Portal
2. Ensure intents are enabled in bot settings
3. Re-invite bot with correct permissions if needed

---

### "Invite rewards not working" (Version 1.4+)

**Problem:** Users don't receive coins when someone joins Discord.

**Checklist:**
- ✅ Discord bot is running (`pm2 list` should show `aether-discord-bot`)
- ✅ Bot has "Manage Invites" permission
- ✅ `BOT_API_KEY` matches in both dashboard and bot `.env` files
- ✅ `DASHBOARD_API_URL` is correct in bot `.env`
- ✅ Check bot logs: `pm2 logs aether-discord-bot`
- ✅ Check dashboard logs: `pm2 logs aether-dashboard`

**Fix:**
1. Ensure bot is running: `pm2 start bot.js --name aether-discord-bot`
2. Verify API keys match in both `.env` files
3. Check that bot has proper Discord permissions

---

### Configuration Issues

### "Bot cannot connect to dashboard"

**Problem:** Discord bot shows errors when trying to connect to dashboard API.

**Checklist:**
- ✅ `DASHBOARD_API_URL` in bot `.env` is correct (e.g., `http://localhost:3000` or `https://yourdomain.com`)
- ✅ Dashboard is running and accessible
- ✅ `BOT_API_KEY` matches in both `.env` files
- ✅ Check bot logs: `pm2 logs aether-discord-bot`

**Fix:**
1. Verify `DASHBOARD_API_URL` in `aether-discord-bot/.env` points to correct dashboard URL
2. Test dashboard accessibility: `curl http://localhost:3000/health`
3. Ensure `BOT_API_KEY` is identical in both `.env` files
4. Check firewall rules allow communication between services

---

### "Dashboard cannot send messages to Discord"

**Problem:** Messages typed in dashboard don't appear in Discord.

**Checklist:**
- ✅ `BOT_API_URL` is correct in dashboard `.env` (e.g., `http://localhost:4000`)
- ✅ `BOT_API_KEY` matches in both `.env` files
- ✅ Bot API server is running (check `pm2 list`)
- ✅ Bot has "Send Messages" permission in Discord channel
- ✅ Check dashboard logs for API errors

**Fix:**
1. Verify `BOT_API_URL` in dashboard `.env` points to correct bot API port (default: 4000)
2. Ensure bot is running: `pm2 logs aether-discord-bot`
3. Check that `BOT_API_KEY` matches exactly in both files
4. Verify bot has proper Discord channel permissions

---

### "Invite rewards not working"

**Problem:** Users don't receive coins when someone joins Discord.

**Checklist:**
- ✅ `BOT_API_KEY` matches in both dashboard and bot `.env` files
- ✅ Bot is running and connected to Discord
- ✅ Bot has "Manage Invites" permission
- ✅ `DASHBOARD_API_URL` is correct in bot `.env`
- ✅ Check bot logs for authentication errors

**Fix:**
1. Verify `BOT_API_KEY` is identical in both `.env` files (no extra spaces or quotes)
2. Ensure bot is running: `pm2 restart aether-discord-bot`
3. Check bot logs: `pm2 logs aether-discord-bot --lines 50`
4. Verify dashboard is accessible from bot's location

---

### "Discord chat messages not appearing" (Version 1.4+)

**Problem:** Messages sent in Discord don't appear in dashboard Community page.

**Checklist:**
- ✅ `DISCORD_CHAT_CHANNEL_ID` is correct in bot `.env`
- ✅ Bot has "Read Message History" and "Send Messages" permissions
- ✅ WebSocket connection is active (check browser console)
- ✅ Bot is online in Discord
- ✅ Check dashboard logs for WebSocket errors

**Fix:**
1. Verify channel ID is correct (right-click channel → Copy ID)
2. Ensure bot has message permissions in that channel
3. Check browser console for WebSocket connection errors

---

### "Dashboard messages not sending to Discord" (Version 1.4+)

**Problem:** Messages typed in dashboard don't appear in Discord.

**Checklist:**
- ✅ `BOT_API_URL` is correct in dashboard `.env`
- ✅ `BOT_API_KEY` matches in both `.env` files
- ✅ Bot API server is running (check `pm2 list`)
- ✅ Bot has "Send Messages" permission in Discord channel
- ✅ Check dashboard logs for API errors

**Fix:**
1. Verify bot API is running: `pm2 logs aether-discord-bot`
2. Check `BOT_API_URL` points to correct port (default: 4000)
3. Ensure API keys match exactly

---

## 🚀 New Features Troubleshooting (Version 1.3+)

### "Server power buttons don't work" (Start/Stop/Restart)

**Problem:** Quick action buttons show error or don't respond.

**Checklist:**
- ✅ Server has a valid `pterodactyl_identifier` (check Admin Panel → Servers)
- ✅ Pterodactyl API key has Client API permissions
- ✅ Server exists in Pterodactyl panel
- ✅ Check logs: `pm2 logs aether-dashboard`

**Fix:** If server was created before v1.3, it may be missing the identifier. Try:
1. Delete and recreate the server, OR
2. Manually update the database (advanced users only)

---

### "Live Stats not loading" (📊 Live Stats page)

**Problem:** Stats page shows "Loading..." forever or shows errors.

**Checklist:**
- ✅ Server is running in Pterodactyl
- ✅ Server has valid `pterodactyl_identifier`
- ✅ Pterodactyl API key works (test in Admin Panel → Panel → Test Connection)

**Common causes:**
- Server is offline (stats only available when server is running)
- API timeout (check your Pterodactyl panel load)

---

### "File Manager not loading files"

**Problem:** File browser shows empty or error.

**Checklist:**
- ✅ Server is running (file API requires running server)
- ✅ Check server logs for errors
- ✅ Try clicking "Refresh" button

**Note:** Some files may not be readable if they're binary files.

---

### "Cannot save file" in File Manager

**Problem:** Editing a file shows error when saving.

**Checklist:**
- ✅ File isn't too large (limit depends on Pterodactyl config)
- ✅ You have write permissions for that file
- ✅ Server is running

**Fix:** Try saving smaller changes, or use "Open in Panel" for large files.

---

### "Backups not creating"

**Problem:** Backup creation fails or times out.

**Checklist:**
- ✅ Server has backup feature enabled in Pterodactyl
- ✅ Server has available backup slots
- ✅ Enough disk space on Pterodactyl node

**Note:** Backup creation can take several minutes for large servers.

---

### "Schedules not running"

**Problem:** Scheduled tasks don't execute.

**Checklist:**
- ✅ Schedule is marked as "Active"
- ✅ Correct cron timing (minute, hour, day, etc.)
- ✅ Server is running when schedule triggers
- ✅ At least one task is added to the schedule

**Tip:** Pterodactyl runs schedules, not the dashboard. Check Pterodactyl panel for schedule status.

---

### "Database creation fails"

**Problem:** Cannot create MySQL database.

**Checklist:**
- ✅ Server has database feature enabled
- ✅ Pterodactyl has database hosts configured
- ✅ Server hasn't reached database limit

**Fix:** Ask your hosting provider to enable database support or increase limits.

---

### "Server Templates not showing"

**Problem:** Templates section is empty for users.

**Checklist:**
- ✅ Templates exist (Admin Panel → Templates tab)
- ✅ Templates are marked as "Active"
- ✅ Templates have valid egg IDs

---

### "Console commands not working"

**Problem:** Sending commands shows success but nothing happens.

**Checklist:**
- ✅ Server is running (commands only work when server is online)
- ✅ Command syntax is correct for your server type
- ✅ User has console permissions

**Note:** Command output isn't visible in dashboard - use "Open in Panel" for full console.

---

## 🔍 General Debugging Tips

### Check Server Status

```bash
# Check if dashboard is running
pm2 list

# Check dashboard logs
pm2 logs aether-dashboard

# Check recent errors only
pm2 logs aether-dashboard --err --lines 50

# Check dashboard status
pm2 status aether-dashboard
```

### Check System Resources

```bash
# Check memory usage
free -h

# Check disk space
df -h

# Check CPU usage
top
```

### Test Database Connection

```bash
# Test if database file exists and is readable
cd AETHER_DASHBOARD
ls -lh database.db
file database.db
```

### Check Network Connectivity

```bash
# Test if dashboard responds locally
curl http://localhost:3000

# Test if port is open
netstat -tuln | grep 3000

# Check firewall status
sudo ufw status
```

---

## 📞 Still Need Help?

If you've tried everything above and still have issues:

1. **Check the logs** - `pm2 logs aether-dashboard --lines 100`
2. **Review the [Installation Guide](README.md)** - Make sure you followed all steps
3. **Check the [Update Guide](UPDATES.md)** - See if there are known issues
4. **Check the [Backup Guide](BACKUP_RECOVERY.md)** - For database-related issues

---

**Last Updated:** Version 1.5.4

**Made with ❤️ for free hosting providers**


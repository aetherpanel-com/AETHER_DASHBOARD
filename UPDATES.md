## Aether Dashboard v1.5.8

### 🎨 Admin Panel UI Revamp

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.8 refreshes the **admin panel only** (not the end-user dashboard). Layout, typography, and spacing are cleaner on desktop; phones and tablets get larger tap targets, stacked toolbars and filters, and safer table scrolling on small screens.

### ✨ Improvements

| Area | Description |
|------|-------------|
| 🎨 **Admin styling** | New dedicated stylesheet `public/css/admin-panel.css` — calmer cards and header, grouped **Overview** tabs (People & servers / Commerce / Platform), improved data tables |
| 📐 **Full-width settings** | Themes, Branding, Linkvertise, and Discord admin pages use the same full content width as Overview and Audit Logs |
| 📱 **Mobile & touch** | Stacked filters on Audit Logs, 2-column then single-column preset grid, overview tab pills sized for touch, safe-area padding, horizontal scroll for wide tables where needed |
| 💜 **Theme presets** | API returns presets in a fixed order with **Default Purple** first; theme settings load before preset buttons so the active preset highlights correctly |

### 🛠️ Technical Notes

- Admin HTML views link `admin-panel.css` after `dashboard.css` (only admin routes).
- **SFTP updates:** Deploy the whole `public/` folder so `admin-panel.css` is present.

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ No database changes in this version.**

---

## Aether Dashboard v1.5.7

### 🐛 Referral UI Bug Fix

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.7 is a minor patch resolving a UI issue where the referral banner was not displaying correctly during signup when following referral links. 

### 🐛 Bug Fixes

| Fix | Description |
|-----|-------------|
| 🎨 **Referral Banner Visibility** | Redirecting to the signup page from a referral link now preserves the `?ref=` query parameter, ensuring the "🎉 You've been referred!" banner is properly displayed to the user. |

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ No database changes in this version.**

---

## Aether Dashboard v1.5.6

### ⏱️ Linkvertise Per-Link Rate Limiting

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.6 introduces powerful new controls for server administrators to prevent users from spamming Linkvertise links and triggering global IP rate blocks.

### 🐛 Bug Fixes & Features

| Feature | Description |
|---------|-------------|
| ⚙️ **Per-Link Limits** | Server admins can now set a "Max Completions per Window" limit for individual links (e.g. 6 completions per day). |
| ⏳ **Custom Frequencies** | Added "Time Window (Hours)" configuration for each link. E.g., setting window to 24 hours creates a daily rolling limit. |
| 🎨 **Dynamic UI Disabled State** | The frontend integration automatically grays out links and displays an explicit "Limit Reached (X/Y)" counter to prevent users from clicking links once they max out their quota. |

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ Database Changes:** This update automatically runs a SQLite migration on startup to append the new `max_completions` and `completion_window_hours` columns to your `linkvertise_links` table. No action is required.

---

# Aether Dashboard - Update Guide

**How to update your dashboard to the latest version without losing data!**

---

## Aether Dashboard v1.5.5

### 🔒 Linkvertise Security Patch

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.5 is a critical security patch resolving a flaw in the Linkvertise integration where users could bypass ads by instantly closing the browser tab.

### 🐛 Bug Fixes & Security

| Fix | Description |
|-----|-------------|
| 🔒 **Linkvertise Exploit Fix** | Replaced the 2-second client-side timeout hack with a secure server-side session and verification callback loop. Users are now required to physically navigate back to the dashboard via a Linkvertise Target URL to receive coins. |
| 🛡️ **Verification Minimum Delay** | Added a strict 15-second server-side minimum delay between starting a link and verifying it, ensuring that manual circumvention attempts are rejected. |

### 🛠️ Important Setup Changes

**For existing Linkvertise links:**
You **must** update the Target URLs on your publisher.linkvertise.com dashboard to point to the new verification endpoint. 
Format: `https://your-domain.com/linkvertise/verify/:id` (where `:id` matches the exact Link ID in your Aether Admin Panel).

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ No database changes in this version.**

---

## Aether Dashboard v1.5.4

### 🔧 Discord Username Sanitization Fix

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.4 is a bug fix patch resolving a sync failure between Discord OAuth and Pterodactyl when a user's Discord username contains special characters not accepted by Pterodactyl's username validation rules.

### 🐛 Bug Fixes

| Fix | Description |
|-----|-------------|
| 🔤 **Discord Username Sanitization** | Discord usernames with special characters (e.g. `.`, `!`, `#`) at the start, end, or throughout are now automatically sanitized before being sent to Pterodactyl. The original username is preserved in the dashboard — only the Pterodactyl panel username is affected. |
| 🔄 **Pterodactyl Sync No Longer Fails** | Server creation and Discord OAuth login no longer silently fail or return 422 errors when a username doesn't meet Pterodactyl's validation rules. |

### 🔧 Sanitization Rules Applied

When passing a username to Pterodactyl, the following transformations are applied:

- Strip all characters except letters, numbers, `_`, `-`, `.`
- Strip leading and trailing special characters
- Truncate to 20 characters maximum
- Pad with random digits if result is shorter than 6 characters
- Fall back to `user_XXXXX` if the result is empty after stripping

The dashboard **always stores and displays the original Discord username** — sanitization only happens at the Pterodactyl API call layer.

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ No database changes in this version.** Existing users are not affected — sanitization applies on the next login or sync attempt.

---

## Aether Dashboard v1.5.3

### 📋 Audit Logs

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.3 introduces a dedicated Audit Logs page for admins, providing full visibility into platform activity — who created or deleted servers, how coins were earned and spent, and when every action happened.

### ✨ New Features

| Feature | Description |
|---------|-------------|
| 📋 **Audit Logs Page** | New admin-only page at `/admin/logs` accessible from Admin Panel → Admin Settings → Audit Logs |
| 🔍 **Filterable Logs** | Filter by action type, username/description search, and date range |
| 🌐 **Timezone Selector** | Per-session timezone dropdown on the Audit Logs page. Defaults to browser local timezone, persists via localStorage |
| ⚙️ **Log Retention Setting** | Admins can configure how many days logs are kept (0 = permanent). Logs older than the threshold are auto-purged on server startup |
| 🗑️ **Manual Clear** | Admins can manually clear all logs with a confirmation prompt |

### 🔍 Logged Events

| Action Type | Trigger |
|-------------|---------|
| `server_created` | User creates a server |
| `server_deleted` | User deletes a server |
| `coins_earned_linkvertise` | User earns coins via Linkvertise |
| `coins_earned_daily_reward` | User claims daily login reward |
| `coins_earned_referral` | User earns coins via referral system |
| `coins_earned_discord_invite` | User earns coins via Discord invite reward |
| `coins_spent_resource` | User purchases RAM, CPU, or Storage |
| `coins_spent_slot` | User purchases a server slot |
| `coins_adjusted_admin` | Admin manually adjusts a user's coins |

### 🗄️ Database Changes

- ✅ Added `activity_logs` table — stores audit log entries (auto-migration on startup)
- ✅ Added `log_retention_days` column to `feature_flags` table (auto-migration, default `90`)

All migrations run automatically on server startup. No manual steps required.

### 🐛 Bug Fixes

| Fix | Description |
|-----|-------------|
| 🕐 **Timestamp Timezone** | Audit log timestamps now display in the viewer's local timezone instead of raw UTC |
| 🎨 **Dark Theme Inputs** | Filter inputs, dropdowns, and date pickers now correctly use the dashboard's dark theme styling |
| 🔤 **Emoji Rendering** | Replaced 📋 emoji in sidebar nav with an inline SVG icon to prevent `????` rendering on some systems |

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ No manual database changes needed** — all new columns and tables are added automatically on startup.

---

## Aether Dashboard v1.5.2

### 🔒 Discord Invite Security & Controls

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.2 is a security and control patch for the Discord invite reward system, closing an exploit and giving admins precise control over coin deductions.

### 🐛 Bug Fixes & Security

| Fix | Description |
|-----|-------------|
| 🔒 **Invite Farming Exploit Fixed** | Users could previously farm coins by repeatedly joining and leaving Discord. Invite records are now kept with a `left_at` timestamp instead of being deleted, and a 24-hour cooldown is enforced before a rejoin can earn a reward again. |
| 🪙 **Exact Coin Deduction** | Deduction on leave now uses the exact `coins_awarded` recorded at join time instead of the current `reward_per_invite` setting — prevents over- or under-deduction if the admin changes the reward amount after the join. |
| 🛡️ **Coins Cannot Go Negative** | Deductions now use `MAX(0, coins - ?)` — a user's balance can never be driven below zero. |
| 📋 **New Invite Cache Events** | Discord bot now listens to `inviteCreate` and `inviteDelete` events so newly created invites are tracked immediately without requiring a bot restart. |

### ✨ New Feature

| Feature | Description |
|---------|-------------|
| ⚙️ **Deduct Per Leave (Admin Setting)** | Admins can now set a custom **Deduct Per Leave** coin amount in Admin Panel → Integrations → Discord. Set to `0` (default) to deduct the exact amount awarded at join. Set to any positive value to deduct a fixed amount instead — useful for partial deductions (e.g. reward 50, deduct 25). |

### 🗄️ Database Changes

- ✅ Added `deduct_per_invite` column to `discord_config` table (auto-migration, default `0`)
- ✅ Added `coins_awarded` column to `discord_invites` table (auto-migration, default `0`)
- ✅ Added `left_at` column to `discord_invites` table (auto-migration, default `NULL`)

All migrations run automatically on server startup. No manual steps required.

### 🔄 Behaviour Changes

- Invite records are **no longer deleted** when a user leaves — they are marked with `rewarded = 0` and `left_at = <timestamp>` for cooldown tracking
- A user who leaves and rejoins within **24 hours** will not trigger a reward for the inviter
- A user who leaves and rejoins after 24 hours **will** re-trigger the reward (record is updated in place)
- The leaderboard and invite stats correctly exclude left users (`WHERE rewarded = 1`) — no change needed there

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
pm2 restart aether-discord-bot
```

**⚠️ No manual database changes needed** — all new columns are added automatically on startup.

---

## Aether Dashboard v1.5.1

### 🐛 Patch Release

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5.1 is a patch release fixing UI and UX issues introduced in v1.5.0,
with no breaking changes and no manual migration steps required.

### Bug Fixes & Improvements

| Fix | Description |
|-----|-------------|
| 🎨 **Branding Flash (FOUC)** | Fixed flash of default logo/name/favicon on every page load. Branding is now injected server-side before first paint — zero flash on hard refresh. |
| 🔑 **Panel Login Credentials** | Users can now view their game panel login credentials (URL, email, password) directly from Settings → Panel Login Credentials. |
| 🔐 **Set / Reset Panel Password** | Users can type a custom panel password (min 8 chars) or click Generate for a random one, then Save to apply it instantly to Pterodactyl. |
| 👤 **Discord User Password Change** | Discord-only users (no dashboard password set) no longer see the "Current Password" field — they can set a new dashboard password directly. |
| 🤖 **Panel Account for Discord Users** | Discord OAuth users now automatically get a Pterodactyl panel account created on first login if one does not already exist. |

### 🔧 Technical Changes

- Added `updatePterodactylUser()` to `config/pterodactyl.js` (PATCH `/application/users/{id}`)
- Added `panel_password` column to `users` table via auto-migration in `config/database.js`
- Added `GET /dashboard/api/panel-credentials` route in `routes/dashboard.js`
- Added `POST /dashboard/api/set-panel-password` route in `routes/dashboard.js`
- Added `has_password` boolean to `GET /dashboard/api/user` response
- Added `generatePanelPassword()` to `utils/helpers.js`, imported by `auth.js` and `dashboard.js`
- Server-side branding injection via `getBrandingSync` + `fs.readFileSync` in all page routes
- Sidebar logo and name now have `id="sidebar-logo"` and `id="sidebar-name"` for reliable JS targeting

### 🚀 How to Update
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ No manual database changes needed** — the `panel_password` column is
added automatically on startup if it does not exist.

---

## Aether Dashboard v1.5.0

### 🚀 Platform Enhancement Update

**Release Date:** March 2026

**Status:** Production Ready ✅

Version 1.5 is a major feature release adding seven new platform features focused on user engagement, admin operations, and real-time feedback.

### ✨ New Features

| Feature | Description |
|---------|-------------|
| 🎁 **Daily Login Rewards** | Streak-based daily coin rewards (Day 1–7). Configurable per-day amounts. Admin toggle. |
| 👥 **User Referral System** | Unique referral links, signup attribution, configurable coin bonuses for referrer and referee. |
| 🔔 **Notification Centre** | Persistent bell across all pages, unread badge, slide-out drawer, real-time toasts via Socket.IO. Supports per-user and global notifications. |
| 📢 **Admin Bulk Broadcast** | Send announcements to all users or by segment. Delivered via notification bell and live Socket.IO toast. History tab for audit trail. |
| 🔧 **Scheduled Maintenance** | Admin-defined windows with start/end times. Sticky banner auto-appears for users when active or upcoming. |
| 📊 **Server Health Timeline** | 24-bar timeline strip on each server card. Background poller every 5 minutes. 24-hour history retained per server. |
| ⚠️ **Resource Usage Warnings** | Live RAM/CPU/disk chips on server cards. Warning at 80%, critical at 90%. Pulled from Pterodactyl in real time. |

### 🗄️ Database Changes

- ✅ Added `daily_reward_config` table — stores per-day coin amounts
- ✅ Added `feature_flags` table — controls daily_rewards and referral_system toggles
- ✅ Added `referral_config` table — stores referrer/referee reward amounts
- ✅ Added `notifications` table — stores per-user and global notifications
- ✅ Added `notification_reads` table — tracks read state for global notifications per user
- ✅ Added `maintenance_schedule` table — stores scheduled maintenance windows
- ✅ Added `broadcast_messages` table — audit log for admin broadcasts
- ✅ Added `server_health_logs` table — stores per-server health snapshots
- ✅ Added `streak_day`, `streak_last_claim` columns to `users` table
- ✅ Added `onboarding_flags` column to `users` table
- ✅ Added `referral_code`, `referred_by`, `referral_coins_earned` columns to `users` table

All migrations run automatically on server startup. No manual steps required.

### 🚀 How to Update
```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep `database.db` and `.env`),
run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

## Aether Dashboard v1.4.5

### 🔒 Resource Purchase Limits

**Release Date:** March 2026

**Status:** Production Ready ✅

Admins can now cap how much of each resource a user is allowed to accumulate
through the store. This prevents a single user from purchasing unlimited
resources and monopolising the platform.

### ✨ New Features

| Feature | Description |
|---------|-------------|
| 🔒 **Resource Purchase Limits** | Admins can set a maximum per-user cap for RAM (GB), CPU (%), Storage (GB), and Server Slots. Configured in Admin Panel → Store Management → Resource Limits. |
| 0️⃣ **Zero = Unlimited** | Setting any limit to `0` disables that cap entirely — fully backwards compatible with existing installations. No data migration required. |
| ⚠️ **Limit Warnings in Store** | The Resource Store now shows users their limit and warns them when a purchase would exceed it, before they attempt to buy. |
| 📊 **Limit Summary in Admin** | The Current Pricing section in Store Management now displays active limits so admins can see them at a glance. |

### 🗄️ Database Changes

- ✅ Added `max_ram_gb` column to `resource_prices` table (auto-migration, default `0` = unlimited)
- ✅ Added `max_cpu_percent` column to `resource_prices` table (auto-migration, default `0` = unlimited)
- ✅ Added `max_storage_gb` column to `resource_prices` table (auto-migration, default `0` = unlimited)
- ✅ Added `max_server_slots` column to `resource_prices` table (auto-migration, default `0` = unlimited)

All migrations run automatically on server startup. No manual steps required.

### 🚀 How to Update

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep `database.db` and `.env`),
run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

## Aether Dashboard v1.4.4

### 🐛 Server Details Polish & Subdomain Addressing

**Release Date:** March 2026

**Status:** Production Ready ✅

This patch release polishes the server details page and completes the
subdomain addressing system introduced in v1.4.3.

### 🐛 Bug Fixes

| Bug | Description |
|-----|-------------|
| 🐛 **Copy Address Emoji** | Clicking "Copy" on a server address no longer includes the 🌐 globe emoji in the clipboard. The raw address (e.g. `mtc.kovaihost.cloud:2014`) is now copied cleanly. |
| 🐛 **Start Button When Online** | Start button is now disabled when the server is already online, preventing accidental double-start attempts. |
| 🐛 **Stop Button When Offline** | Stop button is now disabled when the server is already offline, preventing confusing no-op stop actions. |

### ✨ Improvements

| Improvement | Description |
|-------------|-------------|
| 🌐 **Node Default Aliases** | Admins can set a default subdomain per Pterodactyl node (e.g. `mtc.kovaihost.cloud`) in Admin Panel → Panel → Node Default Aliases. Applied automatically to all allocations on that node during sync. |
| 📊 **Fetch Progress Bars** | "Fetch from Pterodactyl" buttons for both Eggs and Allocations now show animated progress bars while fetching and syncing. |
| ✏️ **Per-Allocation Alias Edit** | Each allocation card now has an inline "Edit Alias" button to override the subdomain directly in Aether without modifying Pterodactyl. |
| 🔒 **Production Safety** | `uncaughtException` handler now calls `process.exit(1)` for clean PM2 restart. Bot status endpoint secured behind `requireAdmin`. `sanitizeBody` applied consistently to admin routes. |

### 🗄️ Database Changes

- ✅ Added `pterodactyl_node_aliases` table (automatic migration on startup)

### 🚀 How to Update

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep `database.db` and `.env`),
run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

## 📋 Before You Start

**⚠️ IMPORTANT:** Always backup your data before updating!

### What to Backup:

1. **Your database file** (`database.db`) - Contains all your users, servers, and settings
2. **Your configuration file** (`.env`) - Contains your API keys and settings

### How to Backup:

```bash
# Connect to your VPS via SSH
cd AETHER_DASHBOARD

# Create a backup folder
mkdir -p backups

# Backup database
cp database.db backups/database-$(date +%Y%m%d-%H%M%S).db

# Backup .env file
cp .env backups/.env-$(date +%Y%m%d-%H%M%S)
```

**✅ Now you're safe to update!**

---

## 🔄 How to Update

**Choose the method based on how you installed the dashboard:**

### Method 1: Automated Update Script (Recommended)

**If you installed using the automated installer:**

```bash
sudo bash /opt/aether-dashboard/update.sh
```

Or download and run:

```bash
curl -O https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/update.sh
sudo bash update.sh
```

**What this does:**
- ✅ Backs up your configuration files and database
- ✅ Pulls latest code from GitHub
- ✅ Updates Node.js dependencies
- ✅ Restarts services safely
- ✅ Verifies update success

**This is the safest and easiest method!**

---

### Method 2: Manual Update

**Choose the method based on how you installed the dashboard:**

### Method 1: If You Installed via GitHub (Git Clone)

**This is the easiest method!**

**Step 1: Connect to your VPS via SSH**

**Step 2: Go to your dashboard folder:**
```bash
cd AETHER_DASHBOARD
```

**Step 3: Stop the dashboard (optional, but recommended):**
```bash
pm2 stop aether-dashboard
```

**Step 4: Pull the latest updates:**
```bash
git pull origin main
```

**What this does:** Downloads the latest version from GitHub

**Step 5: Install any new dependencies:**
```bash
npm install
```

**What this does:** Installs any new packages that were added in the update

**Step 6: Restart the dashboard:**
```bash
pm2 restart aether-dashboard
```

**✅ Done!** Your dashboard is now updated!

---

### Method 2: If You Installed via SFTP (File Upload)

**If you uploaded files manually, follow these steps:**

**Step 1: Connect to your VPS via SSH**

**Step 2: Go to your dashboard folder:**
```bash
cd AETHER_DASHBOARD
```

**Step 3: Stop the dashboard:**
```bash
pm2 stop aether-dashboard
```

**Step 4: Download the latest version:**
- Go to the GitHub repository
- Download the latest version (ZIP file or clone)
- Extract the files on your computer

**Step 5: Upload new files via SFTP:**
- Connect using FileZilla (or similar)
- **IMPORTANT:** Only replace these files/folders:
  - `public/` folder
  - `routes/` folder
  - `views/` folder
  - `config/` folder
  - `middleware/` folder
  - `server.js`
  - `package.json`
  - Any new files (like `reset-admin-password.js`)

**⚠️ DO NOT DELETE OR REPLACE:**
- `database.db` - Your data!
- `.env` - Your configuration!

**Step 6: Install any new dependencies:**
```bash
npm install
```

**Step 7: Restart the dashboard:**
```bash
pm2 restart aether-dashboard
```

**✅ Done!** Your dashboard is now updated!

---

## ✅ Update Checklist

**Use this checklist every time you update:**

- [ ] **Backed up `database.db`** - Your data is safe!
- [ ] **Backed up `.env` file** - Your settings are safe!
- [ ] **Stopped the dashboard** - `pm2 stop aether-dashboard`
- [ ] **Updated the files** - Using git pull or SFTP
- [ ] **Installed dependencies** - `npm install`
- [ ] **Restarted the dashboard** - `pm2 restart aether-dashboard`
- [ ] **Tested the dashboard** - Logged in and checked everything works
- [ ] **Verified data is intact** - Users, servers, and settings are still there

**✅ If all checked, your update was successful!**

---

## 📝 Version Changelog

## Aether Dashboard v1.4.0

### 🎉 Discord Update

**Release Date:** December 2024

**Status:** Production Ready ✅

**🚀 This is a MAJOR feature update!** Version 1.4.0 brings full Discord integration with automated invite rewards, real-time chat, and bidirectional messaging.

**🏗️ Dual-Service Architecture:** This version introduces a dual-service architecture where the dashboard and Discord bot operate as separate services, each with their own `.env` configuration file. This separation improves security by keeping sensitive bot tokens isolated from the dashboard configuration.

### ✨ New Features

| Feature | Description |
|---------|-------------|
| 🤖 **Discord Bot Integration** | Complete Discord bot system for invite tracking and chat synchronization |
| 💰 **Invite Reward System** | Users automatically earn coins when someone joins Discord using their invite link |
| 🔄 **Auto Deduction System** | Rewards automatically removed if invited user leaves the Discord server |
| 💬 **Real-time Discord Chat** | Discord messages mirrored in dashboard Community page with WebSocket |
| 📤 **Bidirectional Messaging** | Send messages from dashboard to Discord and receive Discord messages in dashboard |
| 🏆 **Invite Leaderboard** | Live leaderboard showing top inviters with coins earned |
| 🔍 **Invite Join Detection** | Automatic detection of which invite was used when users join |
| 🛡️ **Abuse Protection** | Duplicate invite joins detected and prevented - each user can only reward once |
| ⚡ **WebSocket Events** | Real-time chat updates via WebSocket for instant synchronization |

### 🎮 System Components

- **Aether Dashboard** - Main dashboard application with Discord integration endpoints
- **Aether Discord Bot** - Standalone Discord bot for invite tracking and message forwarding
- **WebSocket Event System** - Real-time communication between dashboard and Discord
- **Invite Tracking Cache** - Efficient invite usage tracking and comparison
- **Coin Reward Engine** - Automated coin distribution and deduction system

### 📦 New Files & Components

**Discord Bot:**
- `aether-discord-bot/` - Complete Discord bot project
- `aether-discord-bot/bot.js` - Main bot file with invite tracking and message handling
- `aether-discord-bot/package.json` - Bot dependencies (discord.js, axios, express, dotenv)

**Dashboard Integration:**
- `routes/discord.js` - Discord webhook endpoints (`/api/discord/invite-used`, `/api/discord/member-left`, `/api/discord/message`)
- `routes/community.js` - Community page routes with chat API (`/api/community/send-message`)
- `views/community.html` - Community page with Discord chat UI and invite rewards
- `config/database.js` - Added `discord_invites` table for abuse protection

### 🔧 Technical Improvements

- **Express Server in Bot** - Bot includes Express API server for receiving dashboard messages
- **WebSocket Broadcasting** - Dashboard messages broadcast instantly via WebSocket
- **Session Management** - Proper session handling for authenticated API calls
- **Error Handling** - Comprehensive error handling for bot API failures
- **Environment Configuration** - Centralized configuration via `.env` files

### 📊 Database Changes

- ✅ Added `discord_invites` table for tracking rewarded users
  - Columns: `id`, `inviter`, `joined_user`, `invite_code`, `rewarded`, `timestamp`
  - Prevents duplicate rewards for the same user
  - Automatic table creation on server startup

### 🛠 Setup Requirements

**⚠️ Important:** The project now uses a **dual-service architecture** with separate `.env` files for each service. The Discord Bot Token is **NOT stored in the dashboard** - it remains exclusively in the bot's `.env` file for security.

**New Environment Variables:**

**Dashboard `.env` (Root Directory):**
```env
# Internal Bot Communication (required for Discord integration)
BOT_API_URL=http://localhost:4000
BOT_API_KEY=secure_internal_key
```

**Bot `.env` (aether-discord-bot/.env):**
```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token
DASHBOARD_API_URL=http://localhost:3000
BOT_API_KEY=secure_internal_key
BOT_API_PORT=4000
```

**Key Points:**
- 🔒 **Discord Bot Token** is stored ONLY in the bot's `.env` file, never in the dashboard
- 🔑 **BOT_API_KEY** must match exactly in both `.env` files for secure communication
- 🌐 **DASHBOARD_API_URL** in bot `.env` points to where the dashboard API is running
- 📡 **BOT_API_URL** in dashboard `.env` points to where the bot API is running
- ⚙️ **Configuration separation** improves security and maintainability

### 📖 Documentation Updates

- ✅ Added comprehensive Discord bot setup guide in README.md
- ✅ Updated version references to 1.4.0
- ✅ Added Discord integration to feature highlights
- ✅ Included bot setup in Quick Deployment Guide

### ⚠️ Upgrade Notes

**For existing installations upgrading from v1.3.6:**

1. **Install Discord Bot:**
   ```bash
   cd aether-discord-bot
   npm install
   ```

2. **Configure Bot `.env` file** (see setup guide)

3. **Update Dashboard `.env`** with `BOT_API_URL` and `BOT_API_KEY`

4. **Start Discord Bot:**
   ```bash
   pm2 start bot.js --name aether-discord-bot
   pm2 save
   ```

5. **Restart Dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

6. **Configure Discord Integration** in Admin Panel → Integrations → Discord

**⚠️ Important:** The Discord bot must be running for invite rewards and chat features to work!

### 🎯 How It Works

1. **Invite Rewards:**
   - User creates Discord invite link
   - Someone joins Discord using that invite
   - Bot detects which invite was used
   - Dashboard awards coins to inviter
   - If user leaves, coins are automatically deducted

2. **Real-time Chat:**
   - Discord messages sent to dashboard API
   - Dashboard broadcasts via WebSocket
   - Messages appear instantly in Community page
   - Dashboard messages sent to bot API
   - Bot forwards to Discord channel

3. **Abuse Protection:**
   - Each joined user tracked in database
   - Duplicate joins detected and ignored
   - Prevents multiple rewards for same user

### 🔒 Security Features

- Bot API authentication via `BOT_API_KEY`
- Session-based authentication for dashboard API
- Input validation and sanitization
- Error handling prevents information leakage

### 📝 Breaking Changes

- None - This is a feature addition, existing functionality remains unchanged

### 🐛 Bug Fixes

- Fixed dashboard message broadcast timing
- Improved WebSocket connection stability
- Enhanced error handling for bot API failures

### 🚀 Performance Improvements

- WebSocket-based real-time updates reduce API load
- Efficient invite cache system
- Optimized database queries for invite tracking

### 📚 Additional Resources

- See [Discord Bot Setup Guide](#-setting-up-discord-bot-integration) in README.md
- Discord bot README: `aether-discord-bot/README.md`

---

## Aether Dashboard v1.4.3

### 🛠️ Admin UX, Server Status & Addressing Fixes

**Release Date:** March 2026

**Status:** Production Ready ✅

This patch release focuses on day-to-day usability for admins and fixes several server lifecycle edge cases around addressing, uptime, and status transitions.

### ✨ What's New

- **Admin Stat Trends:** The Overview cards now show weekly deltas for total users and total servers.
- **Faster User Management:** Added live search, role filtering, and a searchable username picker for coin adjustments.
- **Tab Persistence:** Admin tabs now store the active tab in the URL hash so reloads reopen the same section.
- **Theme Editor Preview:** Added a live mini sidebar preview for sidebar/background color changes.

### 🖥️ Server Management Fixes

- **Resolved Server Address Fallbacks:** Server details now try to resolve and cache missing addresses instead of staying stuck on "Address not available".
- **`ip_alias` / Subdomain Support:** New and existing servers now prefer allocation `ip_alias` values (subdomains) over raw IPs when available.
- **Correct Offline Mapping:** `unknown` server states are now treated as **Offline** instead of incorrectly showing **Installing**.
- **Better Uptime States:** Offline servers now show a clear offline uptime message, while freshly started servers show a starting state until uptime is reported.
- **Safer Temporary Error Handling:** Temporary Pterodactyl polling failures now show **Checking...** instead of falsely implying the server is still installing.

### 🎨 UI Improvements

- **Server Details Enhancements:** Added copy-address support and better status/power-action feedback.
- **Admin Allocations Visibility:** The allocations list now clearly shows whether each allocation has a configured `ip_alias` subdomain or will fall back to a raw IP.
- **Cleaner Admin Layout:** Removed the duplicate Linkvertise configuration form from the main Admin Panel so Linkvertise settings live only under **Integrations -> Linkvertise**.

### 🧩 Backwards Compatibility

- No database migration required.
- Existing servers can refresh their stored address by opening the server details page after allocations have been synced.
- For subdomain addresses to appear, `ip_alias` must be configured in Pterodactyl and synced into the local `pterodactyl_allocations` table.

---

## Aether Dashboard v1.4.2

### 🎨 Installer UX Refresh & Stability Tweaks

**Release Date:** March 2026

**Status:** Production Ready ✅

This patch focuses on polishing the automated installer experience and making it more resilient in real-world VPS environments.

### ✨ What's New

- **Interactive Installation Wizard:** New banner and sectioned logging make the install flow easier to follow for beginners.
- **Improved Prompts & Labels:** Clearer `[>]` prompts for domain, ports, IP address, SSL email, and overwrite confirmations.
- **Enhanced Completion Summary:** Rich final summary with next steps, useful PM2 commands, and support links.

### 🔧 Technical Improvements

- **Safer APT Handling:** `safe_apt_install()` now tolerates broken third‑party repositories while still installing required packages.
- **IPv4-Only IP Detection:** External IP detection now forces IPv4 and strips whitespace to avoid invalid IP formats.
- **Hardened `safe_curl()`:** Adds `--fail`, redirect following, timeouts, and IPv4 enforcement for all scripted HTTP requests.
- **Corrected Dependency Flow:** Ensures Node.js/npm checks happen after installation and avoids a failing `npm run build` step in non-Next.js environments.
- **Firewall & PM2 Startup:** Opens the dashboard port in UFW and improves PM2 startup/verification logic for more reliable service boot.

### 🧩 Backwards Compatibility

- No database changes.
- Existing installations do not require any manual migration; benefits apply when using the updated `install.sh`.

---

## Aether Dashboard v1.4.1

### 🔧 Installer Improvements & Bug Fixes

**Release Date:** December 2024

**Status:** Production Ready ✅

**🛠️ This is a patch release** that significantly improves the automated installer script with enhanced error handling, better input validation, and improved user experience.

### ✨ Installer Improvements

| Improvement | Description |
|-------------|-------------|
| 🛡️ **Enhanced Error Handling** | Added comprehensive error handling for all package installations, network operations, and service management |
| ✅ **Input Validation** | Added IP address, email, domain, and port validation with user-friendly error messages |
| 🔍 **Port Conflict Detection** | Installer now checks if the selected port is already in use and prompts user for confirmation |
| 🌐 **Network Connectivity Checks** | Verifies internet connectivity before attempting to clone repository |
| 🔐 **Interactive SSL Email** | SSL certificate email is now collected interactively instead of being hardcoded |
| 📡 **DNS Utilities Installation** | Automatically installs `dnsutils` package required for DNS verification |
| ⏱️ **Timeout Protection** | Added timeout protection to curl commands to prevent hanging operations |
| 🔄 **Better DNS Verification** | Improved DNS verification with better error handling and user prompts |
| 📝 **Environment File Warnings** | Added warnings when users skip critical .env file creation |
| 🚀 **NodeSource Installation** | Improved NodeSource script installation with proper error handling |
| 🔧 **PM2 Startup Handling** | Better error handling for PM2 startup configuration |
| 📊 **Enhanced Verification** | Improved installation verification with better status checking |

### 🐛 Bug Fixes

| Bug | Description |
|-----|-------------|
| 🐛 **Domain Validation** | Fixed domain regex to properly handle subdomains (e.g., `sub.dashboard.example.com`) |
| 🐛 **Early Return Issues** | Fixed early returns in .env file creation that could break installation flow |
| 🐛 **Missing DNS Utils** | Fixed missing `dnsutils` package that caused DNS verification to fail |
| 🐛 **Hardcoded SSL Email** | Fixed hardcoded SSL email address - now collected interactively |
| 🐛 **Network Hanging** | Fixed curl commands that could hang indefinitely without timeout |
| 🐛 **Port Validation** | Added proper port availability checking before proceeding |
| 🐛 **Firewall Errors** | Improved firewall configuration error handling |
| 🐛 **PM2 Startup Command** | Fixed PM2 startup command execution with better error handling |

### 🔧 Technical Improvements

- **Safe Package Installation**: New `safe_apt_install()` wrapper function with proper error handling
- **Safe Network Operations**: New `safe_curl()` function with timeout protection
- **Input Validation Functions**: Added `validate_ip()`, `validate_email()`, and `check_port()` helper functions
- **Better User Prompts**: Enhanced interactive prompts with validation loops and clear error messages
- **Graceful Degradation**: Installer continues gracefully when optional steps fail (with user confirmation)
- **Comprehensive Logging**: All operations logged to `/var/log/aether-installer.log` for troubleshooting

### 📋 Installation Flow Improvements

1. **Root Check**: Enhanced root privilege verification
2. **System Checks**: Better detection and installation of missing tools
3. **Network Verification**: Checks connectivity before attempting operations
4. **Interactive Setup**: Improved domain, token, and port collection with validation
5. **IP Detection**: Multiple fallback services with IP format validation
6. **DNS Verification**: Better timeout handling with user confirmation options
7. **Secret Generation**: Verification that secrets were generated successfully
8. **Environment Files**: Better handling when users skip file creation
9. **Dependencies**: Error handling for npm install failures
10. **Nginx Configuration**: Better error messages for configuration failures
11. **SSL Setup**: Interactive email collection and better error handling
12. **Service Management**: File existence checks before starting services
13. **Verification**: Enhanced status checking with better error reporting

### 🎯 User Experience Improvements

- **Clear Error Messages**: All errors now provide actionable guidance
- **Interactive Prompts**: Better prompts with examples and validation
- **Progress Feedback**: Clear progress messages throughout installation
- **Confirmation Options**: Users can cancel or continue at critical decision points
- **Helpful Instructions**: DNS configuration instructions improved with examples
- **Troubleshooting Info**: Better error messages include troubleshooting commands

### ⚠️ Upgrade Notes

**For existing installations:**

- No action required - this is an installer-only update
- Existing installations are not affected
- New installations will benefit from improved installer
- If you want to reinstall, use the updated `install.sh` script

**For new installations:**

- The installer is now more robust and user-friendly
- Better error handling means fewer failed installations
- Interactive prompts guide you through the setup process
- All operations are logged for troubleshooting

### 📚 Documentation Updates

- ✅ Updated version references to 1.4.1
- ✅ Enhanced installer documentation in README.md
- ✅ Added troubleshooting section for installer issues

### 🚀 How to Update

**If you're installing fresh:**

```bash
bash <(curl -s https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/install.sh)
```

**If you already have an installation:**

- No update needed - this only affects new installations
- Your existing installation continues to work as before

### 🔒 Security Improvements

- Better input validation prevents invalid configurations
- Secure secret generation with verification
- Proper file permissions on .env files (600)
- Network timeout protection prevents hanging operations

### 📊 Impact

- **Installation Success Rate**: Significantly improved with better error handling
- **User Experience**: More intuitive and interactive installation process
- **Troubleshooting**: Easier to diagnose issues with comprehensive logging
- **Reliability**: More robust installer that handles edge cases gracefully

---

## Aether Dashboard v1.3.6

### 🚀 Major Improvements

* Implemented **WebSocket-based real-time server updates**
* Removed HTTP polling for server status updates
* Improved performance and reduced API load

### ⚡ Performance Improvements

* Server status updates now pushed via WebSocket
* Lower network overhead compared to polling
* Faster UI updates for server metrics

### 🔧 Stability Improvements

* Fixed logout issues related to polling conflicts
* Improved session stability across dashboard navigation
* WebSocket architecture tested across all dashboard sections

### 🧠 Architecture Improvements

* Introduced server subscription rooms for WebSocket events
* Status updates now emitted directly from the status poller
* Cleaner real-time data flow between backend and frontend

### 📊 Dashboard Enhancements

* Real-time CPU, Memory, Disk, and Network metrics
* Improved server details page with live updates
* WebSocket-first architecture for server monitoring

### 🛠 Internal Changes

* Removed legacy HTTP polling system
* Simplified frontend update logic
* Reduced redundant API calls

### ⚠ Notes

This version introduces a WebSocket-based realtime system.
Existing installations upgrading from **v1.3.5** should restart the dashboard service to initialize the new WebSocket layer.

---

### Version 1.3.5

**Release Date:** March 2026

**Status:** Production Ready ✅

**🎯 This release focuses on enhanced server status management, improved user experience, and better synchronization between dashboard pages.**

**New Features:**

| Feature | Description |
|---------|-------------|
| 🔄 **Enhanced Status Transitions** | Improved server status flow: "Installing" → "Offline" → "Starting" → "Online" → "Stopping" → "Offline" with smooth transitions |
| ⏸️ **Power Button Management** | Power control buttons (Start/Stop/Restart) are automatically disabled during server transitions to prevent multiple simultaneous actions |
| 🔍 **Checking Status** | New "Checking..." status indicator when initially loading server status for better user feedback |
| 📊 **Status Synchronization** | "Manage Servers" and "Live Status" pages now stay perfectly synchronized with consistent polling intervals (5 seconds) |
| 💪 **CPU Limit Flexibility** | Removed 100% CPU limit restriction - users can now allocate CPU above 100% for better Minecraft server performance |

**Bug Fixes:**

| Bug | Description |
|-----|-------------|
| 🐛 **Intermediate Status Display** | Fixed issue where status would show "Online" briefly when stopping server - now shows "Stopping" → "Offline" directly |
| 🐛 **Status Sync Issues** | Fixed synchronization problems between "Manage Servers" and "Live Status" pages - both now update consistently |
| 🐛 **CPU Limit Restriction** | Removed artificial 100% CPU limit cap - users can now set CPU limits above 100% as intended for Minecraft servers |
| 🐛 **Status Polling Race Condition** | Fixed race condition where `refreshStats()` would interfere with power action status updates, causing incorrect status displays |
| 🐛 **New Server Status** | Changed initial server status from "UNKNOWN" to "INSTALLING" for better clarity and user understanding |

**Improvements:**

- 🎯 **Better UX** - Clear status transitions help users understand what's happening with their servers
- 🔒 **Prevented Double Actions** - Buttons disabled during transitions prevent accidental multiple power actions
- ⚡ **Faster Updates** - Reduced status polling interval from 30 seconds to 5 seconds for more responsive updates
- 🔄 **Consistent Behavior** - Both "Manage Servers" and "Live Status" pages now behave identically
- 📱 **Visual Feedback** - New status colors and indicators make server states more obvious
- 🛡️ **State Management** - Improved power action state tracking prevents intermediate status confusion

**Technical Changes:**

- Added `powerActionInProgress` and `powerActionTargetStatus` tracking variables
- Enhanced `sendPowerAction()` function with intelligent status filtering
- Updated `refreshStats()` to respect power action transitions
- Modified status polling logic to filter intermediate states
- Updated status badge rendering for "Installing", "Starting", "Stopping", and "Checking" states
- Removed CPU limit validation from both frontend and backend

**How to Update:**

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

### Version 1.3.4 🎉

**Release Date:** March 2026

**Status:** Production Ready ✅

**🔒 This release focuses on critical security enhancements, rate limiting, and improved error handling.**

**Security Enhancements:**

| Feature | Description |
|---------|-------------|
| 🛡️ **XSS Protection** | Fixed XSS vulnerabilities by properly escaping user-controlled data in all innerHTML operations. All user input and API responses are now sanitized before display. |
| ⏱️ **Rate Limiting** | Added comprehensive rate limiting to prevent abuse: Authentication endpoints (5 attempts/15min), Server creation (10/hour), Purchases (30/10min), Linkvertise (20/5min). |
| 🔄 **Improved Cleanup** | Enhanced server creation cleanup logic with centralized cleanup function to handle all edge cases and prevent resource leaks. |

**Bug Fixes:**

| Bug | Description |
|-----|-------------|
| 🐛 **XSS Vulnerabilities** | Fixed multiple XSS vulnerabilities in admin panel, server details, and linkvertise views by using escapeHtml() for all user-controlled data. |
| 🐛 **Server Creation Cleanup** | Improved cleanup logic to ensure placeholder server records and claimed allocations are always released on error, preventing resource leaks. |
| 🐛 **Rate Limit Bypass** | Added rate limiting to prevent brute-force attacks and resource exhaustion attacks on authentication and API endpoints. |

**Improvements:**

- 🔒 **Security First** - All user input is now properly sanitized before display
- ⚡ **Performance** - Rate limiting prevents abuse and ensures fair resource usage
- 🧹 **Code Quality** - Centralized cleanup function reduces code duplication
- 🛡️ **Protection** - Multiple layers of protection against common attack vectors
- 📊 **Monitoring** - Rate limit headers provide visibility into request patterns

**Dependencies:**

- Added `express-rate-limit` package for rate limiting functionality

**How to Update:**

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

### Version 1.3.3 🎉

**Release Date:** March 2026

**Status:** Production Ready ✅

**🔧 This release focuses on user management enhancements, disconnect panel improvements, and UI refresh fixes.**

**New Features:**

| Feature | Description |
|---------|-------------|
| ✏️ **Edit User Functionality** | Admins can now edit user details (username, email, admin status) directly from the Users table with a new Edit button and modal dialog. |
| 🔄 **Disconnect Panel Options** | Added user removal options dialog when disconnecting panel - choose to remove only imported users or all imported users including admins. |
| 🆔 **Default Admin ID** | Default admin account now uses ID 0 instead of auto-increment for easy identification. |

**Bug Fixes:**

| Bug | Description |
|-----|-------------|
| 🐛 **Disconnect Panel Validation** | Fixed critical bug where panel config was deleted before validation, causing inconsistent state. Validation now happens first, preventing panel from appearing disconnected when user removal fails. |
| 🐛 **Total Users Card Refresh** | Fixed Total Users card not updating immediately after importing users from panel. Now refreshes automatically without page reload. |
| 🐛 **Debug Logging Cleanup** | Removed all debug logging statements (port 7244 fetch calls) that were causing ECONNREFUSED errors in logs. Cleaner production logs. |

**Improvements:**

- 👥 **User Management** - Edit user details and roles directly from admin panel
- 🔒 **Safety Checks** - Enhanced validation for user role changes (prevents lockout scenarios)
- 🎯 **UI Responsiveness** - Stats cards now update automatically after operations
- 🧹 **Code Cleanup** - Removed unnecessary debug logging for cleaner production environment
- ⚡ **Better UX** - Disconnect panel now provides clear options for user removal

**How to Update:**

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

### Version 1.3.2 🎉

**Release Date:** March 2026

**Status:** Production Ready ✅

**🔧 This release focuses on automatic EULA acceptance, allocation management fixes, and improved file operations reliability.**

**New Features:**

| Feature | Description |
|---------|-------------|
| ✅ **Automatic EULA Acceptance** | Minecraft EULA is now automatically accepted in the background when server details page loads or when server starts. Runs silently without user interaction. |
| 🔄 **Smart Retry Logic** | EULA acceptance includes intelligent retry mechanism (up to 3 attempts with 5-second delays) for cases where eula.txt hasn't been generated yet. |
| 📊 **Status Change Detection** | Automatically detects when server transitions from offline to starting and triggers EULA acceptance. |

**Bug Fixes:**

| Bug | Description |
|-----|-------------|
| 🐛 **Allocation Fetching** | Fixed allocation sync endpoint to correctly extract allocation IDs from Pterodactyl API response structure. |
| 🐛 **Allocation Auto-Sync** | "Fetch from Pterodactyl" button now automatically syncs allocations to database after fetching. |
| 🐛 **File Write Operations** | Fixed `writeFile` function to always use Client API key for `/client/servers/` endpoints, preventing 403 errors. |
| 🐛 **Coins Display** | Fixed coins showing as 0 in server details page by ensuring user data is loaded on page mount. |
| 🐛 **EULA File Operations** | Improved error handling for EULA file read/write operations with better 404 detection and content type handling. |

**Improvements:**

- 🤖 **Background Automation** - EULA acceptance runs automatically without user interaction
- 🔇 **Silent Operation** - All EULA operations run silently (console logs only, no user notifications)
- 🔄 **Better Retry Logic** - Intelligent retry mechanism for file operations
- 📝 **Enhanced Logging** - Better debug logging for EULA and file operations
- 🎯 **Status Monitoring** - Automatic detection of server state changes
- 🔧 **Error Handling** - Improved error detection and handling for file operations

**How to Update:**

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

### Version 1.3.1 🎉

**Release Date:** March 2026

**Status:** Production Ready ✅

**🔧 This is a bug fix and stability release** that addresses critical issues found in production and improves error handling across the dashboard.

**Bug Fixes:**

| Bug | Description |
|-----|-------------|
| 🐛 **HTML Error Pages** | Fixed raw HTML error pages (like Cloudflare 504) being displayed to users. Now extracts readable error messages. |
| 🐛 **409 Conflict Handling** | Server power actions and status checks now handle "server still installing" state gracefully with user-friendly messages. |
| 🐛 **Power Actions with Default Admin** | Fixed power actions (Start/Stop/Restart) to work with default dashboard admin account (no longer requires Pterodactyl user linking). |
| 🐛 **Panel Disconnect** | Fixed disconnect panel feature to properly remove imported users from database and update Total Users count. |
| 🐛 **Linkvertise Security** | Added missing `escapeHtml` function to prevent XSS vulnerabilities in link titles/URLs. |
| 🐛 **Linkvertise Validation** | Added validation to prevent completing deleted/inactive links and ensure link exists before awarding coins. |
| 🐛 **Linkvertise Cooldown** | Fixed link ID type inconsistency that caused cooldown checks to fail. Now handles both string and integer IDs. |
| 🐛 **Linkvertise Race Condition** | Wrapped completion recording and coin addition in database transaction for atomicity. |
| 🐛 **Linkvertise Timestamp Parsing** | Improved timestamp parsing with error handling to prevent cooldown calculation failures. |
| 🐛 **Linkvertise Memory Leak** | Added timer cleanup on page unload to prevent memory leaks from orphaned cooldown timers. |

**Improvements:**

- 🛡️ **Better Error Handling** - HTML error pages now show readable messages instead of raw HTML
- ⚡ **Transient Error Handling** - 409 Conflict responses show info messages instead of errors, with auto-retry
- 🔄 **Auto-Refresh** - Total Users card and Users list now refresh automatically after panel disconnect
- 💾 **Transaction Support** - Added database transaction helper for atomic operations
- 🔒 **Security Enhancements** - Better input validation and XSS prevention in Linkvertise component
- 📊 **UI Improvements** - Better error messages and user feedback throughout the dashboard

**Database Changes:**

- ✅ Added `client_api_key` column to `pterodactyl_config` table (automatic migration)
- ✅ Added `client_api_key` column to `users` table (automatic migration)
- ✅ All migrations run automatically on startup

**How to Update:**

```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

### Version 1.3 🎉

**Release Date:** March 2026

**Status:** Production Ready ✅

**🚀 This is a MAJOR feature update!** Version 1.3 brings powerful server management features that make your dashboard stand out from competitors.

**New Features:**

| Feature | Description |
|---------|-------------|
| ⚡ **Quick Server Actions** | Start/Stop/Restart/Kill servers with one click directly from server cards |
| 📦 **Server Templates** | Admins can create pre-configured templates for instant server deployment |
| 📊 **Live Stats Dashboard** | Real-time CPU, RAM, Disk, Network graphs using Chart.js |
| 💻 **Console Commands** | Send commands to server console without opening Pterodactyl |
| 📁 **File Manager** | Browse, edit, create, delete, rename, compress files directly |
| 💾 **Backup System** | Create, download, restore, and delete server backups |
| ⏰ **Scheduled Tasks** | Schedule server restarts, commands, and automatic backups |
| 🗃️ **Database Manager** | Create, manage, and rotate MySQL database passwords |
| 🚨 **Usage Alerts** | Warning notifications when CPU/RAM/Disk usage is high |

**Bug Fixes (20+ Pterodactyl Integration Fixes):**
- 🐛 **Allocation Management** - Allocations now properly removed after server creation
- 🐛 **Server Identifier** - Fixed panel URLs using wrong ID type (now uses identifier)
- 🐛 **OOM Disabled Field** - Build updates now include required `oom_disabled` field
- 🐛 **Power Signals** - Fixed power actions using wrong API endpoint (now uses Client API)
- 🐛 **Server Resources** - Fixed stats endpoint (now uses Client API correctly)
- 🐛 **Egg ID Matching** - Fixed type mismatch in egg selection
- 🐛 **Environment Variables** - Better parsing for all variable formats
- 🐛 **Nest ID** - Server creation now includes required nest ID
- 🐛 **Discord OAuth** - Now updates username/email on login
- 🐛 **Timezone Issues** - Linkvertise cooldowns now use consistent UTC timestamps
- 🐛 **User Deletion** - Now properly deletes user from Pterodactyl panel
- 🐛 **Panel Disconnect** - Fixed incorrect resource return calculation
- 🐛 **Session Data** - User session now includes all required fields
- 🐛 **Race Conditions** - Atomic allocation claiming prevents double-booking
- 🐛 **Install Scripts** - Server creation now properly triggers install scripts
- 🐛 **Pagination** - API calls now request up to 100 items per page
- 🐛 **User Lookup** - Efficient email/external ID filtering in API calls
- 🐛 **External ID** - User creation now supports external ID for linking
- 🐛 **File Writing** - Fixed Content-Type for file write operations

**Improvements:**
- 🛡️ **Global Error Handlers** - Prevents server crashes from unhandled errors
- ⏱️ **Request Timeout Protection** - 60-second timeout prevents hanging requests
- 🏥 **Health Check Endpoint** - `/health` endpoint for monitoring
- 🔌 **Pterodactyl API Timeouts** - 30/60 second timeouts for API calls
- 📊 **Chart.js Integration** - Beautiful real-time graphs for server stats

**Database Changes:**
- ✅ Added `pterodactyl_identifier` column to servers table
- ✅ Added `server_templates` table for admin templates
- ✅ All migrations run automatically on startup

**How to Update:**
```bash
# GitHub method (recommended)
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

Or via SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard.

**⚠️ Important:** Always backup `database.db` and `.env` before updating!

---

### Version 1.2.1

**Release Date:** Previous

**Bug Fixes:**
- 🐛 **Fixed [object Object] Error Display** - Error messages now display properly instead of showing `[object Object]`
  - Improved `showNotification` function to handle object errors
  - Enhanced error message extraction in server creation
  - Better error handling for all API responses

**Improvements:**
- 🛡️ **Global Error Handlers** - Added handlers for unhandled promise rejections and exceptions
  - Prevents server crashes from unhandled errors
  - Better error logging with stack traces
- ⏱️ **Request Timeout Protection** - Added 60-second timeout for all requests
  - Prevents hanging requests that cause 502 errors
  - Better error messages for timeout scenarios
- 🏥 **Health Check Endpoint** - Added `/health` endpoint for monitoring
  - Useful for Cloudflare health checks
  - Returns server status and uptime
- 🔌 **Pterodactyl API Timeouts** - Added timeout protection for Pterodactyl API calls
  - 30-second default timeout for regular API calls
  - 60-second timeout for server creation (can take longer)
  - Better error messages for timeout scenarios

**How to Update:**
- If using GitHub: `git pull origin main && npm install && pm2 restart aether-dashboard`
- If using SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard

**Note:** This is a stability and bug fix release. No database migrations needed!

---

### Version 1.2

**Release Date:** Previous

**New Features:**
- ✅ **Logo Shape Customization** - Choose from 6 different logo shapes!
  - Available shapes: Square, Circle, Rounded, Triangle, Hexagon, Diamond
  - Live preview in Admin Settings
  - Applies to all logos across the dashboard
  - Accessible via Admin Settings → Branding Settings → Logo Shape dropdown

- ✅ **Branding Assets Reorganization** - Better file organization
  - Default assets moved to `public/assets/defaults/`
  - User-uploaded assets stored in `public/assets/branding/`
  - Cleaner separation between default and custom branding

- ✅ **Admin Watermark** - "Powered by Aether Dashboard" watermark
  - Appears on Admin Panel and Admin Settings pages
  - Fixed position in bottom-right corner
  - Subtle, non-intrusive design
  - Responsive for mobile devices

**Improvements:**
- 🎨 **Branding Flexibility** - More customization options for dashboard appearance
- 🐛 **Bug Fixes** - Fixed Admin Settings link disappearing when navigating between pages
- 📱 **Mobile Support** - Watermark adapts to mobile screen sizes
- 🔧 **Code Optimization** - Improved multer configuration for file uploads

**How to Update:**
- If using GitHub: `git pull origin main && npm install && pm2 restart aether-dashboard`
- If using SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard

**Note:** The database will automatically add the `logo_shape` column on first run. No manual migration needed!

---

### Version 1.0.4

**Release Date:** Previous

**New Features:**
- ✅ **Admin Password Reset Script** - Reset your admin password without losing data!
  - New file: `reset-admin-password.js`
  - Use: `node reset-admin-password.js "your-new-password"`
  - Safe: Does NOT delete any data

**Improvements:**
- 📚 **Updated Documentation** - Better password recovery instructions
- 🔧 **Better Troubleshooting** - Clearer steps for password recovery

**How to Update:**
- If using GitHub: `git pull origin main && npm install && pm2 restart aether-dashboard`
- If using SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard

---

### Version 1.0.3

**Release Date:** Previous

**New Features:**
- ✅ **Mobile-Responsive Design** - Full mobile support!
  - Hamburger menu for mobile navigation
  - Scrollable admin tables on mobile
  - Scrollable tab navigation on mobile
  - Touch-friendly buttons and forms
  - Responsive layout for all screen sizes

**Improvements:**
- 📱 **Mobile UI** - Dashboard now works perfectly on phones and tablets
- 🎨 **Better UX** - Improved user experience on mobile devices
- 📊 **Scrollable Tables** - Admin panel tables scroll horizontally on mobile
- 🧭 **Scrollable Tabs** - Tab navigation scrolls on mobile

**How to Update:**
- If using GitHub: `git pull origin main && npm install && pm2 restart aether-dashboard`
- If using SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard

---

### Version 1.0.2

**Release Date:** Previous

**New Features:**
- ✅ **Production Stability** - Better support for production environments
  - Reverse proxy support (Nginx)
  - HTTPS/SSL support
  - Session cookie improvements
  - Server binding improvements

**Improvements:**
- 🔒 **Security** - Better session handling
- 🌐 **Production Ready** - Works behind reverse proxies
- 📝 **Documentation** - Comprehensive production setup guide

**How to Update:**
- If using GitHub: `git pull origin main && npm install && pm2 restart aether-dashboard`
- If using SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard

---

### Version 1.0.1

**Release Date:** Previous

**New Features:**
- ✅ **Production Stability Fixes** - Fixed issues with reverse proxy
- ✅ **Session Improvements** - Better cookie handling for HTTPS

**Improvements:**
- 🔧 **Bug Fixes** - Fixed login redirect issues
- 📚 **Documentation** - Updated README for Linux VPS

**How to Update:**
- If using GitHub: `git pull origin main && npm install && pm2 restart aether-dashboard`
- If using SFTP: Download latest version, replace files (keep database.db and .env), run `npm install`, restart dashboard

---

### Version 1.0.0

**Release Date:** Initial Release

**Features:**
- ✅ **Core Dashboard** - Complete dashboard functionality
- ✅ **User Management** - User registration and management
- ✅ **Server Management** - Create and manage game servers
- ✅ **Linkvertise Integration** - Revenue generation via Linkvertise
- ✅ **Resource Store** - Purchase RAM, CPU, Storage with coins
- ✅ **Admin Panel** - Full admin control panel
- ✅ **Pterodactyl Integration** - Connect to Pterodactyl panel

**Initial Release:**
- Production-ready dashboard
- Complete documentation
- Linux VPS installation guide

---

## ❓ Troubleshooting Updates

### "Update failed" or "Git pull doesn't work"

**If you get errors when updating:**

1. **Check if you're in the right folder:**
   ```bash
   pwd
   ```
   Should show: `/root/AETHER_DASHBOARD` or similar

2. **If using GitHub, check your connection:**
   ```bash
   git status
   ```
   This shows if you have a git repository

3. **If files are modified, you might need to stash changes:**
   ```bash
   git stash
   git pull origin main
   ```

### "Dashboard won't start after update"

1. **Check the logs:**
   ```bash
   pm2 logs aether-dashboard
   ```

2. **Reinstall dependencies:**
   ```bash
   npm install
   ```

3. **Restart the dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

### "I lost my data after updating"

**If you accidentally deleted your database:**

1. **Check your backups:**
   ```bash
   ls -la backups/
   ```

2. **Restore from backup:**
   ```bash
   cp backups/database-YYYYMMDD-HHMMSS.db database.db
   ```

3. **Restart the dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

**💡 Always backup before updating!**

---

## 📞 Need Help?

If you encounter issues during updates:

1. **Check the logs:** `pm2 logs aether-dashboard`
2. **Review this guide** - Most issues are covered here
3. **Check the main README** - Installation and troubleshooting guide
4. **Restore from backup** - If something goes wrong, restore your backup

---

## 💡 Tips for Smooth Updates

1. **Always backup first** - Never skip this step!
2. **Update during low traffic** - Less disruption for users
3. **Test after updating** - Make sure everything works
4. **Keep backups** - Don't delete old backups immediately
5. **Read changelog** - Know what changed in each version

---

**Last Updated:** Version 1.5.8

**Made with ❤️ for free hosting providers**


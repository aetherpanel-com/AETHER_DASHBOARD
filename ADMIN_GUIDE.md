# Aether Dashboard — Admin Guide

Complete guide for setting up and managing your Aether Dashboard after installation.

**Version:** 1.5.8 | **Status:** Production Ready ✅

> **New to Aether Dashboard?** Complete the installation steps in [README.md](README.md) first, then return here to set up your admin panel.

---

## 📋 Table of Contents

1. [First-Time Setup Order](#-first-time-setup-order)
2. [Accessing the Admin Panel](#-accessing-the-admin-panel)
3. [Overview Tab](#-overview-tab)
4. [Users Tab](#-users-tab)
5. [Servers Tab](#-servers-tab)
6. [Coin Management Tab](#-coin-management-tab)
7. [Store Management Tab](#-store-management-tab)
8. [Server Templates Tab](#-server-templates-tab)
9. [Panel Tab — Pterodactyl Setup](#-panel-tab--pterodactyl-setup)
10. [Admin Settings — Themes](#-admin-settings--themes)
11. [Admin Settings — Branding](#-admin-settings--branding)
12. [Integrations — Linkvertise](#-integrations--linkvertise)
    - [Target URL on Linkvertise (Post & earn)](#setting-the-target-url-in-linkvertise-post--earn)
13. [Integrations — Discord](#integrations--discord)
14. [Audit Logs](#-audit-logs)
15. [Admin Setup Checklist](#-admin-setup-checklist)
- [Daily Rewards Tab](#-daily-rewards-tab)
- [Referral Tab](#-referral-tab)
- [Maintenance Tab](#-maintenance-tab)
- [Broadcast Tab](#-broadcast-tab)

---

## 🚦 First-Time Setup Order

When setting up for the first time, follow this order. Doing things out of
sequence (e.g. creating templates before syncing eggs) will cause errors.

```
1. Change default admin password
2. Connect Pterodactyl panel          → Admin Panel → Panel → Panel Configuration
3. Set Node Default Aliases           → Admin Panel → Panel → Node Default Aliases
4. Fetch & Sync Allocations           → Admin Panel → Panel → Server Allocations
5. Fetch & Sync Eggs (Game Types)     → Admin Panel → Panel → Game Types (Eggs)
6. Configure Store prices             → Admin Panel → Store Management
7. Create Server Templates            → Admin Panel → Server Templates
8. Configure Daily Rewards            → Admin Panel → Daily Rewards tab
9. Configure Referral System          → Admin Panel → Referral tab
10. Configure Linkvertise             → Admin Panel → Integrations → Linkvertise
11. (Optional) Set up Discord bot     → Admin Panel → Integrations → Discord
12. (Optional) Schedule Maintenance   → Admin Panel → Maintenance tab
13. (Optional) Send Broadcasts        → Admin Panel → Broadcast tab
14. (Optional) Customise theme        → Admin Panel → Admin Settings → Themes
15. (Optional) Customise branding     → Admin Panel → Admin Settings → Branding
16. (Optional) Review Audit Logs      → Admin Panel → Admin Settings → Audit Logs
```

---

## 🛡️ Accessing the Admin Panel

1. Log in to the dashboard as the admin user
2. The **Admin Panel** item appears at the bottom of the left sidebar
3. Click it to expand — it reveals **Overview**, **Admin Settings**, and **Integrations**
4. Under **Admin Settings**, you'll find **Themes**, **Branding**, and **Audit Logs**
5. Click **Overview** to open the main admin panel

> **Default credentials:** username `admin`, password `admin123`
> ⚠️ Change this immediately after first login via Profile → Change Password

### Phones and tablets

On narrow screens, open the sidebar with the **☰** (hamburger) button in the top-left. Admin-only pages use extra responsive rules (stacked search bars and filters, touch-sized tabs and buttons, horizontal scrolling for wide tables). If you update via **SFTP**, deploy the full `public/` folder so `admin-panel.css` is included.

---

## 📊 Overview Tab

The Overview is the landing page of the admin panel. It contains:

### Stat Cards
Three cards at the top showing:
- **Total Users** — registered user count with a weekly delta (e.g. `+2 this week`)
- **Total Servers** — active servers across all users with a weekly delta
- **Total Coins** — sum of all coins held by all users

These update automatically after operations like importing users or adjusting coins.

### Tab groups (Overview)

The main card is organised into **groups** so related tools stay together. Each item is a pill-shaped tab.

| Group | Tabs |
|-------|------|
| **People & servers** | Users, Servers, Coin management |
| **Commerce** | Store, Templates |
| **Platform** | Daily rewards, Maintenance, Broadcast, Panel |

Click a tab to switch. The active section is stored in the **URL hash** (e.g. `#users`, `#coins`, `#templates`) so you can bookmark or reload the same view.

---

## 👥 Users Tab

View and manage all registered users.

### Searching and Filtering
- Use the **search bar** to filter by username or email in real time
- Use the **role dropdown** to show All, Admin only, or Users only

### Editing a User
1. Click the **Edit** button on any user row
2. Change username, email, or admin status in the modal
3. Click Save — changes take effect immediately

> ⚠️ **Lockout protection:** You cannot remove admin status from the last
> remaining admin account. At least one admin must always exist.

### Deleting a User
Click **Delete** on a user row. If Pterodactyl is connected, the user's
Pterodactyl account is also deleted. This action cannot be undone.

### Importing Users from Pterodactyl
If you have existing Pterodactyl users, click **Import Users from Panel**
to bulk-import them. Existing dashboard accounts with matching emails are
linked; new accounts are created for the rest.

---

## 🖥️ Servers Tab

View all servers created by all users across the platform.

- Shows server name, owner username, RAM, CPU, and storage
- Admins can **Delete** any server — this removes it from both Aether and Pterodactyl

> This tab is read-only beyond deletion. Users manage their own servers
> from the Manage Servers page.

---

## 🪙 Coin Management Tab

Manually add or remove coins from any user's balance.

### Using the Coin Form
1. Start typing in the **Username** field — a dropdown appears showing matching users with their current balance
2. Select the user from the dropdown
3. Enter an **Amount** — use a positive number to add coins, negative to remove (e.g. `-50`)
4. Click **Update Coins**

The user's new balance is shown in the success notification. The Users tab
also refreshes automatically.

---

## 🏪 Store Management Tab

Set the coin prices users pay to purchase resources.

### Resource Pricing
Configure how many coins users pay per unit for:
- **RAM** — coins per GB block
- **CPU** — coins per % block
- **Storage** — coins per GB block
- **Server Slots** — coins per additional server slot

### How to Update Prices
1. Change the values in the form
2. Click **Save Prices**
3. New prices apply immediately to future purchases — existing purchases are not affected

> Tip: Check the **Current Pricing** section below the form to see what
> users are currently paying before changing prices.

### Resource Limits Per User

Below the pricing form is a **Resource Limits** section. This sets a ceiling
on the total amount of each resource any single user can accumulate through
purchases.

| Field | Description |
|-------|-------------|
| **Max RAM (GB)** | Maximum total RAM a user can own. e.g. `32` = 32GB cap. |
| **Max CPU (%)** | Maximum total CPU a user can own. e.g. `400` = 400% cap. |
| **Max Storage (GB)** | Maximum total storage a user can own. e.g. `100` = 100GB cap. |
| **Max Server Slots** | Maximum server slots a user can own. e.g. `5` = 5 slots max. |

Set any value to **0** to disable that limit (unlimited).

> These limits apply to the **total purchased amount**, not to individual
> servers. A user with a 32GB RAM limit and three servers using 8GB each
> has used 24GB — they can still purchase 8GB more, but not 16GB.

Limits are enforced on the server side — users cannot bypass them by
submitting requests directly to the API.

---

## 📦 Server Templates Tab

Create pre-configured server types that users can deploy instantly with
one click, without selecting egg, RAM, CPU, and storage manually.

### Creating a Template
1. Fill in **Template Name** (e.g. "Minecraft Paper 1.20")
2. Choose an **Icon** emoji (shown on the template card)
3. Select a **Game Type (Egg)** from the dropdown — eggs must be synced first
4. Set **RAM (MB)**, **CPU (%)**, and **Storage (MB)**
5. Add an optional **Description**
6. Click **Add Template**

> ⚠️ Eggs must be fetched and synced in the Panel tab before they appear
> in the egg dropdown here.

### Managing Templates
- Use the **Active** toggle on each template to show or hide it from users
- Use **Display Order** to control the order templates appear in
- Click **Delete** to remove a template permanently

---

## 🔌 Panel Tab — Pterodactyl Setup

This is the most important section for a functioning dashboard. Everything
related to your Pterodactyl panel lives here.

### Panel Configuration

**Connecting your panel:**
1. Enter your **Panel URL** (e.g. `https://panel.yourdomain.com`)
2. Enter your **Application API Key** — generated in Pterodactyl under Admin → Application API
3. Enter your **Client API Key** — generated in Pterodactyl under Account → API Credentials
4. Click **Test Connection** — both keys are validated separately
5. Click **Connect Panel** to save

> The Application API key is encrypted at rest in the database using AES-256.

**Disconnecting:**
Click **Disconnect Panel** to remove the connection. You will be asked
whether to also remove imported users from the dashboard.

---

### Node Default Aliases

This section lets you map a subdomain to a Pterodactyl node so users see
a clean address (e.g. `mtc.yourhost.com:25565`) instead of a raw IP.

**How to set it up:**
1. Find your Node ID — it is shown on each allocation card below as "Node: 6"
2. Enter the **Node ID** and the **hostname** (no port, just the domain)
3. Click **Save Alias**
4. Then go to Server Allocations and click **Fetch from Pterodactyl** → the sync
   will apply this alias to all allocations on that node

**Example:**
| Node ID | Default Alias |
|---------|---------------|
| 6 | `mtc.yourhost.com` |

> You can also override individual allocation aliases using the ✏️ Edit Alias
> button on each allocation card.

---

### Game Types (Eggs)

Eggs are the game server templates from Pterodactyl (e.g. Paper Minecraft,
Vanilla, Forge). They must be synced here before you can create Server Templates.

**Fetching eggs:**
1. Click **Fetch from Pterodactyl** — a progress bar shows while eggs load
2. Each egg card shows its Egg ID, Nest ID, and Docker image
3. **Check the boxes** next to the eggs you want to make available
4. Click **Sync Selected to Database**

**Loading cached eggs:**
Click **Load Cached** to display the eggs already saved in the database
without making an API call.

> Only eggs synced to the database can be used in Server Templates and
> by users when creating servers.

---

### Server Allocations

Allocations are the IP:Port combinations assigned to servers. They must
be synced before users can create servers.

**Fetching allocations:**
1. Click **Fetch from Pterodactyl** — fetches all **unassigned** allocations
2. A progress bar shows while allocations load and auto-sync to the database
3. Each card shows the address, Raw IP, Allocation ID, Node, and Priority

**Understanding the address display:**
- ✅ **Green badge** — allocation has a subdomain alias (e.g. `mtc.yourhost.com:2014`)
- ⚠️ **Yellow badge** — no alias set, users will see the raw IP

**Setting priorities:**
Higher priority allocations are assigned first when users create servers.
Use this to prefer certain ports or nodes over others.

**Inline alias editing:**
Each allocation card has an ✏️ **Edit Alias** button. Click it to set or
change the subdomain for that specific allocation without going back to
Pterodactyl.

---

### Pterodactyl Settings

- **Default Nest ID** — the nest used when no specific nest is specified during server creation
- **Default Location ID** — the default Pterodactyl location for new servers

---

### Sync Existing Users

If users already have Pterodactyl accounts (e.g. from an existing panel),
click **Sync Users to Pterodactyl** to link their dashboard accounts.

Click **Import Users from Panel** for a detailed progress import with
a live log showing each user's status.

---

## 🎨 Admin Settings — Themes

Customise the look of the dashboard for all users.

### Quick Presets
Click any preset card to instantly apply that theme. Presets load
immediately and apply a full colour scheme.

**Default Purple** is the default preset for new installs and is listed first. If you have saved a **custom** theme, no preset may appear selected until you choose a preset again or reset the theme.

### Custom Theme Editor
Fine-tune every colour individually:

| Section | What it controls |
|---------|-----------------|
| **Sidebar** | Background gradient/solid, text colour, active and hover states |
| **Main Frame** | Page background gradient |
| **Accent Colours** | Primary, secondary, tertiary, success, warning, danger colours |
| **Cards & Components** | Card background and border colours |
| **Inputs** | Input field background, border, text, and placeholder colours |
| **Header** | Top header bar background and text |

**Live preview:** A mini sidebar in the top of the editor updates in real
time as you change sidebar colours — no need to save to see the effect.

**Saving:** Click **Save Theme** to apply to all users. Changes take effect
immediately on next page load.

---

## ✨ Admin Settings — Branding

Customise the dashboard name, logo, and favicon shown to all users.

### Dashboard Name
The name shown in the sidebar header and browser title. Change it to your
hosting brand name.

### Logo
Upload a custom logo image (PNG, JPG, WEBP — max 5MB).

### Logo Shape
Choose how the logo is displayed:
- **Circle** — round crop (good for profile-style logos)
- **Square** — no crop
- **Rounded** — rounded corners
- **Hexagon / Triangle / Diamond** — decorative clip shapes

### Favicon
Upload a `.ico` or PNG file to replace the browser tab icon.

---

## 💰 Integrations — Linkvertise

Linkvertise is how your users earn coins — they complete monetised links
you configure, and you earn revenue from Linkvertise.

### Linkvertise Configuration

1. **Publisher Link** — your Linkvertise publisher account URL
   (e.g. `https://publisher.linkvertise.com/ac/1450748`)
2. **Publisher ID** — auto-extracted from the link, or enter manually
3. **Default Coins per Link** — coins awarded to users for completing a link
4. **Cooldown Timer** — seconds a user must wait before completing the
   same link again (default: 30 seconds)
5. Click **Save Configuration**

### Managing Links

**Adding a link:**
1. Click **Add New Link**
2. Enter a **Title** (shown to users), the **Linkvertise URL** (the
   monetised link — NOT your publisher link), **Coins Reward**, and
   whether it is **Active**
   - **Max Completions per Window** (v1.5.6+): Set a strict limit on how many times a user can complete this link (e.g. 6). Set to 0 for unlimited.
   - **Time Window (Hours)** (v1.5.6+): Define the cooldown period for exactly when limits reset (e.g. 24 for a daily cap).
3. Click **Save Link**

**Editing / deleting links:**
Use the Edit and Delete buttons on each link card. Inactive links are
hidden from users but not deleted.

> ⚠️ The Linkvertise URL field should contain the actual monetised link
> users will complete (e.g. `https://linkvertise.com/123456/my-link`),
> not your publisher account URL.

### Setting the target URL in Linkvertise (Post & earn)

Each card under **Manage Links** shows a **Link ID** (for example
`Link ID: 7`). That number **must** match the `<linkid>` in the
verification URL you set as the **destination** on Linkvertise. If they
do not match, users will not land on the correct verification step for
that link.

**URL pattern:**

`https://dashboard.yourdomain.com/linkvertise/verify/<linkid>`

Replace `dashboard.yourdomain.com` with your real dashboard hostname, and
`<linkid>` with the **Link ID** from the Aether admin **Manage Links** card.

**Example:**

`https://dashboard.yourdomain.com/linkvertise/verify/1`

**In the Linkvertise publisher dashboard:**

1. Open the Linkvertise publisher dashboard and sign in.
2. Click **Post & earn** (top of the page).
3. On step **1 — Type**, choose **Link**, then click **Next**.
4. When prompted to enter the link URL, paste your full verification URL:
   `https://<your-dashboard-host>/linkvertise/verify/<linkid>` using the
   same **Link ID** as on the **Manage Links** card in Aether.
5. Click **Next**.
6. On step **2 — Meta**, it is **recommended** to turn **Visibility** on
   and fill in **Title**, **Cover** image, and other meta details so the
   post performs well on Linkvertise.
7. Click **Next**.
8. On step **3 — Access**, choose the access and unlock options you want
   (defaults such as **All** are fine unless you need something stricter).
9. Click **Publish**. Linkvertise will give you the final monetised link —
   enter that URL in the dashboard **Linkvertise URL** field for this link
   (**Add New Link** or **Edit** under **Manage Links**).

---

## Integrations — Discord

Connect a Discord bot to enable invite rewards and real-time chat sync
between Discord and the dashboard Community page.

### Bot Status Indicator
The 🟢 Online / 🔴 Offline indicator shows whether the Discord bot is
currently connected and sending heartbeats. It updates every 10 seconds.

### Discord Configuration

| Setting | Description |
|---------|-------------|
| **Server ID** | Your Discord server (guild) ID |
| **Bot Token** | Stored in the bot's `.env` file only — not here |
| **Enable Invite Rewards** | Toggle the coin reward system on/off |
| **Reward per Invite** | Coins awarded per successful invite join |
| **Deduct per Leave** | Coins deducted when an invited user leaves. Set to `0` to deduct the exact amount that was awarded at join time. Set to any positive value to deduct a fixed amount instead (e.g. set to `25` when reward is `50` for a partial deduction). |
| **Enable Chat Bridge** | Mirror Discord messages to the Community page |
| **Chat Channel ID** | Discord channel ID to bridge messages from/to |
| **Discord Invite Link** | Optional `https://discord.gg/…` or `https://discord.com/invite/…` (also `discordapp.com`) URL. Shown to all users as the **Discord icon** (`public/icons/discord.svg`) next to the notification bell in the header; opens in a new tab. If left empty, clicking it shows a themed message that the link is not configured. |

> **Username Handling (v1.5.4+):** If a user's Discord username contains characters not accepted by Pterodactyl (such as leading/trailing `.`, `!`, or `#`), the username is automatically sanitized before being sent to the panel. The original Discord username is always preserved in the dashboard. A warning is logged to PM2 when sanitization occurs — check with `pm2 logs aether-dashboard`.

### How the Invite Reward System Works
1. A user copies their Discord invite link from the Community page
2. Someone joins your Discord using that link
3. The bot detects which invite was used and calls the dashboard API
4. The inviting user receives the configured coin reward automatically
5. If the invited user leaves Discord, coins are automatically deducted (exact amount awarded, or the configured Deduct per Leave amount)
6. A 24-hour cooldown prevents the same user from repeatedly joining and leaving to farm coins

### Setting Up the Discord Bot
See the full bot setup instructions in [README.md](README.md) under
**Setting Up Discord Bot Integration**.

---

## 🎁 Daily Rewards Tab

Configure the streak-based daily login reward system.

- **Feature Enabled toggle** — enables or disables the entire daily reward system for all users
- **Reward Amounts** — set the coin amount for each day (Day 1 through Day 7)
- Day 7 is highlighted with a ⭐ as the streak completion bonus
- Click **Save Rewards** to apply changes immediately

> Users must claim their reward each day before midnight UTC. Missing a day resets their streak to Day 1.

---

## 👥 Referral Tab

Configure the referral coin reward system.

- **Feature Enabled toggle** — enables or disables the referral system for all users
- **Referrer Reward** — coins awarded to the user who shared the referral link
- **Referee Reward** — coins awarded to the new user who signs up via the link
- Click **Save Referral Config** to apply

> Users find their referral link on their Profile page. The link pre-fills the signup form automatically.

---

## 🔧 Maintenance Tab

Schedule and manage platform maintenance windows.

- **Title** — short name for the maintenance (e.g. "Database Upgrade")
- **Start / End** — datetime-local picker for the window start and end
- **Message** — description shown in the banner to users
- Click **Schedule** to save the window

When a window is active (current time is between start and end), a **red sticky banner** appears at the top of all dashboard pages. When a window is upcoming, an **amber banner** with a countdown appears instead.

Click **Cancel** on any window to deactivate it early.

---

## 📋 Audit Logs

View a complete history of platform activity from Admin Panel → Admin Settings → Audit Logs.

### What Gets Logged
Every significant action is automatically recorded — server creation and deletion, all coin earning methods (Linkvertise, daily rewards, referrals, Discord invites), coin purchases, and admin manual coin adjustments.

### Filters
Use the filter bar to narrow logs by action type, username or description keyword, and date range.

### Timezone
The page includes a **Display Timezone** dropdown in the filter bar. It defaults to your browser's local timezone and saves your preference via localStorage. This only affects how timestamps are displayed — storage is always UTC.

### Settings
- **Log Retention (days)** — How many days of logs to keep. Set to `0` for permanent storage. Logs older than the threshold are deleted automatically each time the server starts.
- **Clear All Logs** — Permanently deletes all log entries. Requires confirmation.

---

## 📢 Broadcast Tab

Send platform-wide announcements to users.

- **Title** — heading shown in the notification bell
- **Type** — Info / Success / Warning / Alert (controls colour and icon)
- **Segment** — All users / Users with servers / Users without servers / Users with 0 coins
- **Message** — body of the announcement
- Click **Send Broadcast** to deliver immediately

Broadcasts are stored in the notification bell for all users and also appear as a live toast popup for any user currently online at the time of sending. A **Broadcast History** table shows all previously sent broadcasts.

---

## ✅ Admin Setup Checklist

Use this checklist when setting up a fresh installation:

**Required — must complete before users can create servers:**
- [ ] Changed admin password (Profile → Change Password)
- [ ] Connected Pterodactyl panel (Panel tab → Panel Configuration)
- [ ] Set Node Default Alias for each node (Panel tab → Node Default Aliases)
- [ ] Fetched and synced allocations (Panel tab → Server Allocations)
- [ ] Fetched and synced at least one egg (Panel tab → Game Types)
- [ ] Set store prices (Store Management tab)
- [ ] Created at least one server template (Server Templates tab)
- [ ] Added at least one Linkvertise link (Integrations → Linkvertise), with the Linkvertise **Post & earn** destination set to `https://<your-host>/linkvertise/verify/<linkid>` matching the **Link ID** on the card

**Recommended:**
- [ ] Uploaded custom logo and set branding (Admin Settings → Branding)
- [ ] Set dashboard name to your brand (Admin Settings → Branding)
- [ ] Applied a custom theme (Admin Settings → Themes)
- [ ] Review Audit Logs after go-live to confirm events are being captured (Admin Settings → Audit Logs)
- [ ] Configured Discord bot (Integrations → Discord)
- [ ] Set Default Nest ID and Location ID (Panel tab → Pterodactyl Settings)
- [ ] Configured Daily Rewards amounts (Daily Rewards tab)
- [ ] Enabled Referral System and set reward amounts (Referral tab)

---

## 📖 Related Documentation

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Installation, setup, and general overview |
| [UPDATES.md](UPDATES.md) | Version changelog and update instructions |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and fixes |
| [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) | Backup and restore procedures |

---

**Made with ❤️ for free hosting providers**

**Last Updated:** Version 1.5.8

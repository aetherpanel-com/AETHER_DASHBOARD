# Aether Dashboard - Free Hosting Revenue Platform

A powerful **overlay dashboard** for **free hosting providers** to monetize their services through Linkvertise. Your users complete links to earn coins, which they use to purchase server resources (RAM, CPU, Storage) for their game servers.

**Perfect for hosting owners who want to earn revenue from their free hosting services!**

**Version:** 1.5.8

**Status:** Production Ready ✅

**📦 Want to update?** See the [Update Guide](UPDATES.md) for instructions on how to update to the latest version!

**🔧 Latest Update (v1.5.8):** Admin panel UI revamp — cleaner desktop layout, grouped Overview tabs, full-width Themes/Branding/Integrations pages, and mobile-friendly admin screens. New file: `public/css/admin-panel.css`. No database changes. See [UPDATES.md](UPDATES.md) for details.

---

## 🎯 What is This?

**Aether Dashboard** is a complete revenue platform designed specifically for **free hosting providers** who want to:

- 💰 **Monetize your hosting** - Users complete Linkvertise links to earn coins, generating revenue for you
- 🎮 **Manage game servers** - Integrate with Pterodactyl panel to provide Minecraft, CS:GO, and other game servers
- 👥 **Control your business** - Full admin panel to manage users, pricing, resources, and revenue
- 🚀 **Easy setup** - Designed for Linux VPS (the standard for hosting providers)
- ⚡ **Full server control** - Start/stop/restart, file manager, console, backups - all from one dashboard!

### How It Works

1. **Your users** complete Linkvertise links to earn coins
2. **You earn revenue** from Linkvertise when users complete links
3. **Users spend coins** to purchase server resources (RAM, CPU, Storage)
4. **Users create servers** using their purchased resources (or use quick templates!)
5. **Users manage servers** directly from the dashboard (no need to open Pterodactyl!)
6. **You manage everything** through the admin panel

**Perfect for free hosting businesses!** No complex setup needed.

---

## ✨ What's New in Version 1.5.3

**Platform Enhancement Update** — v1.5 adds a full suite of engagement, monetisation, and operational features to the dashboard, making it the most complete version yet.

### 📋 Audit Logs (Version 1.5.3)
A dedicated admin page at Admin Panel → Admin Settings → Audit Logs. Logs every key platform event with username, action type, description, and timestamp. Filterable by type, user, and date range. Includes per-session timezone display, configurable log retention, and manual clear.

### 🎁 Daily Login Rewards
Streak-based daily reward system. Users earn configurable coin amounts for each consecutive day they log in (Day 1–7). Admins configure coin amounts per day and can enable/disable the feature from the Admin Panel → Daily Rewards tab.

### 👥 User Referral System
Users get a unique referral link they can share. When someone signs up using their link, both the referrer and the new user earn configurable coin bonuses. Admins configure rewards from Admin Panel → Referral tab.

### 🔔 Notification Centre
A persistent notification bell in the header across all dashboard pages. Supports per-user and global (broadcast) notifications with unread badge counts, a slide-out drawer, and real-time toast popups via Socket.IO.

### 📢 Admin Bulk Broadcast
Admins can send announcements to all users (or a segment) from Admin Panel → Broadcast tab. Broadcasts are delivered as global notifications in the notification bell and as live toasts via Socket.IO.

### 🔧 Scheduled Maintenance
Admins can schedule maintenance windows with a start and end time from Admin Panel → Maintenance tab. A sticky banner automatically appears across all pages for users when a window is active or upcoming.

### 📊 Server Health Timeline
A 24-bar health timeline strip appears on each server card, showing the last 24 polling snapshots (online/offline/starting). The poller runs every 5 minutes in the background and stores history in the database.

### ⚠️ Resource Usage Warnings
Live RAM, CPU, and disk usage chips on server cards. Yellow chips appear at 80% usage, red at 90%. Data is pulled from Pterodactyl in real time.

---

## 🚀 Automated Installation (Recommended)

**The easiest way to install Aether Dashboard!** Use our automated installer script for a hassle-free setup.

### Quick Install

**Run this single command on your Linux VPS:**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/install.sh)
```

**Or download and run locally:**

```bash
curl -O https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/install.sh
sudo bash install.sh
```

### What the Installer Does

The automated installer will:

✅ **Check system requirements** - Verifies Node.js, npm, and other dependencies  
✅ **Install system packages** - Nginx, Certbot, PM2, and more  
✅ **Configure firewall** - Sets up UFW with proper ports  
✅ **Clone repository** - Downloads latest code to `/opt/aether-dashboard`  
✅ **Generate secure secrets** - Creates random session secrets and API keys  
✅ **Setup SSL certificate** - Automatically configures HTTPS with Let's Encrypt  
✅ **Configure Nginx** - Sets up reverse proxy for your domain  
✅ **Start services** - Launches dashboard and Discord bot with PM2  
✅ **Verify installation** - Tests that everything is working correctly  

### Installation Requirements

Before running the installer, make sure you have:

- **Root access** to your Linux VPS (Ubuntu 22.04 / Debian recommended)
- **Domain name** pointing to your server (or IP address for testing)
- **Discord Bot Token** (if using Discord integration)
- **Ports open**: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### Installation Process

1. **Run the installer:**
   ```bash
   bash <(curl -s https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/install.sh)
   ```

2. **Follow the prompts:**
   - Enter your domain name (e.g., `dashboard.example.com`)
   - Enter your Discord Bot Token (optional)
   - Choose dashboard port (default: 3000)
   - Configure DNS when prompted
   - Wait for DNS verification

3. **Access your dashboard:**
   - Open `https://your-domain.com` in your browser
   - Default login: `admin` / `admin123`
   - ⚠️ **Change password immediately!**

### Updating the Dashboard

**To update to the latest version:**

```bash
sudo bash /opt/aether-dashboard/update.sh
```

Or download and run:

```bash
curl -O https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/update.sh
sudo bash update.sh
```

The update script will:
- Backup your configuration files
- Pull latest code from GitHub
- Update dependencies
- Restart services safely

### Uninstalling

**To completely remove Aether Dashboard:**

```bash
sudo bash /opt/aether-dashboard/uninstall.sh
```

Or download and run:

```bash
curl -O https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/uninstall.sh
sudo bash uninstall.sh
```

**⚠️ Warning:** This will remove all data, configuration, and services. Backups are preserved in `/opt/aether-dashboard/backups/` if created.

### Installation Location

The installer installs to:

- **Installation Directory:** `/opt/aether-dashboard`
- **Logs:** `/var/log/aether-installer.log`
- **PM2 Services:** `aether-dashboard`, `aether-discord-bot`
- **Nginx Config:** `/etc/nginx/sites-available/aether-dashboard`

### Useful Commands After Installation

```bash
# Check service status
pm2 status

# View logs
pm2 logs aether-dashboard
pm2 logs aether-discord-bot

# Restart services
pm2 restart aether-dashboard
pm2 restart aether-discord-bot

# View installation logs
cat /var/log/aether-installer.log
```

### Troubleshooting Installation

**If installation fails:**

1. **Check the logs:**
   ```bash
   cat /var/log/aether-installer.log
   ```

2. **Verify system requirements:**
   - Ubuntu 22.04 / Debian 11+ recommended
   - Root access required
   - Internet connection needed

3. **Common issues:**
   - **DNS not resolving:** Wait longer for DNS propagation (can take up to 48 hours)
   - **Port already in use:** Change the dashboard port in the installer
   - **SSL certificate fails:** Ensure DNS is properly configured before running installer

4. **Manual installation:** If automated installer fails, see [Manual Installation Guide](#-step-by-step-installation-guide) below

---

## 📖 Admin Panel Guide

Already installed? Ready to configure your panel?

👉 **[See the Admin Panel Guide (ADMIN_GUIDE.md)](ADMIN_GUIDE.md)** for:
- Step-by-step first-time setup order
- How to connect and configure Pterodactyl
- Setting up subdomain addresses (Node Default Aliases)
- Linkvertise monetisation setup
- Server templates, store pricing, themes, and branding
- Discord bot integration guide

---

## 🚀 Quick Deployment Guide

**Want to get started fast?** Follow these quick steps. For detailed explanations, see the [Full Installation Guide](#-step-by-step-installation-guide) below.

### Prerequisites
- A Linux VPS (Ubuntu/Debian recommended)
- SSH access to your VPS
- Domain name (optional, but recommended)

### Quick Steps

**1. Connect to your VPS:**
```bash
ssh username@your-vps-ip
```

**2. Update system:**
```bash
sudo apt update && sudo apt upgrade -y
```

**3. Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**4. Get dashboard code:**
```bash
git clone https://github.com/aetherpanel-com/AETHER_DASHBOARD.git
cd AETHER_DASHBOARD
```

**5. Install dependencies:**
```bash
npm install
```

**6. Create configuration file:**
```bash
nano .env
```
Paste this (change `SESSION_SECRET` to a random 32+ character string):
```env
# Server Configuration
PORT=3000
NODE_ENV=production
SESSION_SECRET=your_session_secret_here

# HTTPS Configuration (set to 'true' if using HTTPS/SSL)
USE_HTTPS=true

# Discord OAuth (optional - for user login via Discord)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback

# Pterodactyl Panel (optional - for game server management)
PTERODACTYL_URL=
PTERODACTYL_API_KEY=

# Internal Bot Communication (required for Discord integration)
BOT_API_KEY=secure_internal_key
BOT_API_URL=http://localhost:4000
```
Save: `Ctrl + X`, then `Y`, then `Enter`

**7. Install PM2 and start dashboard:**
```bash
sudo npm install -g pm2
pm2 start server.js --name aether-dashboard
pm2 save
pm2 startup  # Follow the instructions it gives you
```

**8. Configure firewall:**
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

**9. Access your dashboard:**
Open `http://your-vps-ip:3000` in your browser

**Default Login:**
- Username: `admin`
- Password: `admin123`
- ⚠️ **Change this immediately after first login!**

**✅ Done!** Your dashboard is running! 

**Next Steps:**
- [Set up Linkvertise for revenue](#-setting-up-revenue-generation-linkvertise)
- [Configure Pterodactyl integration](#-setting-up-pterodactyl-panel-integration-optional) (optional)
- [Set up domain & HTTPS](#-setting-up-domain--https-optional-but-recommended) (recommended)

---

## 📚 Linux Basics - Don't Worry, It's Easy!

**Never used Linux before?** Don't worry! Here's what you need to know:

### What is a VPS?
A **VPS (Virtual Private Server)** is like having your own computer in the cloud. You control it remotely.

### What is SSH?
**SSH (Secure Shell)** is how you connect to your VPS from your computer. It's like remote desktop, but for Linux.

### What is a Terminal?
A **terminal** (also called "command line" or "console") is a text-based way to control your computer. Instead of clicking buttons, you type commands.

### How to Use This Guide
- **Commands to type** are shown in gray boxes like this:
  ```bash
  type this command here
  ```
- **Replace text** in `brackets` with your actual information
- **Press Enter** after typing each command
- **Don't type the `$` or `#`** - those are just prompts showing you're in the terminal

### Common Terms You'll See
- **`sudo`** = "super user do" - gives you permission to do admin tasks (you'll type your password)
- **`cd`** = "change directory" - moves you to a different folder
- **`nano`** = a simple text editor (like Notepad, but in terminal)
- **`pm2`** = a tool that keeps your dashboard running

**Don't worry if this seems confusing!** Just follow the steps one by one, and you'll be fine! 🚀

---

## 📋 What You Need Before Starting

Before installing, make sure you have:

1. **A Linux VPS** (Ubuntu, Debian, CentOS, or RHEL)
   - Most hosting providers use Linux
   - If you're not sure what you have, it's probably Ubuntu (most common)
   
2. **SSH access to your VPS**
   - Your VPS provider should give you:
     - An IP address (like `123.45.67.89`)
     - A username (usually `root` or `ubuntu`)
     - A password (or SSH key)
   
3. **A domain name** (optional but recommended)
   - You can start with just an IP address
   - Domain makes it look more professional (like `dashboard.yoursite.com`)

4. **Node.js** - We'll install this together (don't worry about it now!)

**Don't have a VPS yet?** Popular options:
- **DigitalOcean** - Very beginner-friendly, $5/month
- **Vultr** - Good performance, $2.50/month
- **Linode** - Reliable, $5/month
- **Hetzner** - Great value, €4/month
- **Contabo** - Budget-friendly

---

## 🚀 Step-by-Step Installation Guide

**Follow these steps in order. Don't skip any steps!**

### Step 1: Connect to Your VPS (SSH)

**What you're doing:** Connecting your computer to your VPS so you can control it.

#### On Windows:

1. **Download PuTTY** (free SSH client):
   - Go to: https://www.putty.org/
   - Download and install PuTTY
   - Or use Windows Terminal (Windows 10/11) or PowerShell

2. **Open PuTTY** (or Windows Terminal/PowerShell)

3. **Type this command:**
   ```bash
   ssh username@your-vps-ip
   ```
   
   **Replace:**
   - `username` with your VPS username (usually `root` or `ubuntu`)
   - `your-vps-ip` with your VPS IP address
   
   **Example:**
   ```bash
   ssh root@123.45.67.89
   ```

4. **Press Enter**

5. **If it asks "Are you sure you want to continue?"** - Type `yes` and press Enter

6. **Enter your password** when prompted (you won't see the password as you type - that's normal!)

7. **You're connected!** You should see something like:
   ```
   root@your-server:~#
   ```

#### On Mac/Linux:

1. **Open Terminal** (search for "Terminal" in Applications)

2. **Type the same command:**
   ```bash
   ssh username@your-vps-ip
   ```

3. **Follow the same steps as Windows**

**💡 Tip:** If you can't connect, check:
- Is your VPS running?
- Is the IP address correct?
- Did you enter the password correctly?
- Check your VPS provider's documentation for SSH setup

---

### Step 2: Update Your System

**What you're doing:** Making sure your VPS has the latest software updates.

**First, check what Linux you're using:**
```bash
cat /etc/os-release
```

**Look for "NAME="** - it will say Ubuntu, Debian, CentOS, or something similar.

#### If you have Ubuntu or Debian:

Type this command:
```bash
sudo apt update && sudo apt upgrade -y
```

**What this does:**
- `sudo` = gives you admin permission (you'll type your password)
- `apt update` = checks for updates
- `apt upgrade -y` = installs updates (the `-y` means "yes to everything")

**What you'll see:**
- It will ask for your password (type it and press Enter)
- Lots of text scrolling (this is normal!)
- It may take 1-5 minutes

#### If you have CentOS or RHEL:

Type this command:
```bash
sudo yum update -y
```

**Same thing, different command!**

**✅ When it's done:** You'll see your prompt again (like `root@server:~#`)

---

### Step 3: Install Node.js

**What you're doing:** Installing Node.js, which is needed to run the dashboard.

#### For Ubuntu/Debian:

**Step 3.1: Install curl (a tool we need)**
```bash
sudo apt install curl -y
```

**Step 3.2: Add Node.js repository**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

**What this does:** Downloads and sets up the Node.js installation files

**What you'll see:** Lots of text scrolling - this is normal! Wait for it to finish.

**Step 3.3: Install Node.js**
```bash
sudo apt install -y nodejs
```

**What you'll see:** More text scrolling. Wait for it to finish.

**Step 3.4: Check if it worked**
```bash
node --version
```

**What you should see:** Something like `v20.11.0` or similar (a version number)

**Also check npm:**
```bash
npm --version
```

**What you should see:** Something like `10.2.4` or similar

**✅ If you see version numbers:** Node.js is installed correctly! 🎉

**❌ If you see "command not found":** Something went wrong. Try the steps again or check the troubleshooting section.

#### For CentOS/RHEL:

**Step 3.1: Install curl**
```bash
sudo yum install curl -y
```

**Step 3.2: Add Node.js repository**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
```

**Step 3.3: Install Node.js**
```bash
sudo yum install -y nodejs
```

**Step 3.4: Check if it worked**
```bash
node --version
npm --version
```

**Same as above - you should see version numbers!**

---

### Step 4: Get the Dashboard Code on Your VPS

**What you're doing:** Getting the dashboard files onto your VPS.

**Choose one method:**

#### Option A: Upload Files via SFTP (Easiest for Beginners)

**This is like copying files to your VPS using a program like FileZilla.**

1. **Download FileZilla** (free):
   - Go to: https://filezilla-project.org/
   - Download FileZilla Client
   - Install it

2. **Open FileZilla**

3. **Connect to your VPS:**
   - **Host:** `sftp://your-vps-ip` (replace with your IP)
   - **Username:** Your VPS username
   - **Password:** Your VPS password
   - **Port:** `22`
   - Click **"Quickconnect"**

4. **Upload the dashboard folder:**
   - On the left: Find your dashboard folder on your computer
   - On the right: Navigate to `/root` or `/home/username`
   - Drag the dashboard folder from left to right
   - Wait for upload to finish

5. **In your SSH terminal, navigate to the folder:**
   ```bash
   cd AETHER_DASHBOARD
   ```
   
   (Replace `AETHER_DASHBOARD` with whatever you named the folder)

#### Option B: Clone from GitHub (If You Have GitHub)

**Only use this if you have the code on GitHub!**

**Step 4.1: Install git**
```bash
sudo apt install git -y  # Ubuntu/Debian
# OR
sudo yum install git -y  # CentOS/RHEL
```

**Step 4.2: Clone the repository**
```bash
git clone https://github.com/aetherpanel-com/AETHER_DASHBOARD.git
```

**Step 4.3: Go into the folder**
```bash
cd AETHER_DASHBOARD
```

**✅ You should now be in the dashboard folder!**

**How to check:** Type `pwd` and press Enter. It should show the folder path.

---

### Step 5: Install Dependencies

**What you're doing:** Downloading all the code libraries the dashboard needs to run.

**Make sure you're in the dashboard folder first!** (You should be from Step 4)

Type this command:
```bash
npm install
```

**What this does:** Downloads and installs all required software packages

**What you'll see:**
- Lots of text scrolling (this is normal!)
- It may take 1-3 minutes
- You'll see lines like "added 245 packages"

**✅ When it's done:** You'll see your prompt again. No errors = success!

**❌ If you see errors:** Check the troubleshooting section.

---

### Step 6: Create Configuration File

**What you're doing:** Creating a settings file that tells the dashboard how to run.

**Step 6.1: Create the file**
```bash
nano .env
```

**What this does:** Opens a text editor called "nano" to create/edit the `.env` file

**What you'll see:** A blank screen (or some text if the file exists)

**Step 6.2: Copy and paste this content:**

**⚠️ IMPORTANT:** Right-click in the terminal to paste (or `Shift + Insert`)

```env
# Server Configuration
PORT=3000
NODE_ENV=production
SESSION_SECRET=change-this-to-a-very-long-random-text-at-least-32-characters-abc123xyz789

# HTTPS Configuration (set to 'true' if using HTTPS/SSL)
USE_HTTPS=true

# Discord OAuth (optional - leave empty if not using)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_CALLBACK_URL=https://yourdomain.com/auth/discord/callback

# Pterodactyl Panel (optional - configure via Admin Panel after installation)
PTERODACTYL_URL=
PTERODACTYL_API_KEY=

# Internal Bot Communication (required for Discord integration)
BOT_API_KEY=secure_internal_key
BOT_API_URL=http://localhost:4000
```

**Step 6.3: Make these changes:**

1. **Change `SESSION_SECRET`:** 
   - Replace the long text with any random text (at least 32 characters)
   - Example: `my-super-secret-key-abc123xyz789-very-secure-2024`
   - You can use letters, numbers, and dashes

2. **If you have a domain:** Replace `yourdomain.com` with your actual domain

3. **If using HTTP (not HTTPS):** Change `USE_HTTPS=true` to `USE_HTTPS=false`

**Step 6.4: Save the file:**

1. **Press `Ctrl + X`** (to exit)
2. **Press `Y`** (to confirm you want to save)
3. **Press `Enter`** (to confirm the filename)

**✅ You're back at the terminal!** The file is saved.

**💡 Tip:** If you make a mistake, just type `nano .env` again to edit it!

---

### Step 7: Start the Dashboard with PM2

**What you're doing:** Starting the dashboard and making sure it keeps running.

**PM2** is a tool that:
- Keeps your dashboard running even if it crashes
- Automatically restarts it if something goes wrong
- Keeps it running even if you close your SSH connection

**Step 7.1: Install PM2**
```bash
sudo npm install -g pm2
```

**What this does:** Installs PM2 globally so you can use it anywhere

**What you'll see:** Text scrolling, then your prompt returns

**Step 7.2: Start the dashboard**
```bash
pm2 start server.js --name aether-dashboard
```

**What this does:** Starts your dashboard with the name "aether-dashboard"

**What you should see:**
```
[PM2] Starting in fork_mode
[PM2] Successfully started
┌─────┬──────────────────┬─────────┬─────────┬──────────┐
│ id  │ name             │ status  │ restart │ uptime   │
├─────┼──────────────────┼─────────┼─────────┼──────────┤
│ 0   │ aether-dashboard │ online  │ 0       │ 0s       │
└─────┴──────────────────┴─────────┴─────────┴──────────┘
```

**✅ If you see this:** Your dashboard is running! 🎉

**Step 7.3: Save PM2 configuration**
```bash
pm2 save
```

**What this does:** Saves the current setup so PM2 remembers it

**Step 7.4: Set up auto-start on reboot**
```bash
pm2 startup
```

**What this does:** Makes the dashboard start automatically when your VPS reboots

**What you'll see:** It will give you a command to run. It will look like:
```
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-username --hp /home/your-username
```

**Copy that entire command** (the one starting with `sudo`) and paste it, then press Enter.

**✅ Done!** Your dashboard will now start automatically on reboot!

**Useful PM2 Commands (for later):**
```bash
pm2 list                    # See all running apps
pm2 logs aether-dashboard   # See what's happening (logs)
pm2 restart aether-dashboard  # Restart the dashboard
pm2 stop aether-dashboard     # Stop the dashboard
```

---

### Step 8: Configure Firewall

**What you're doing:** Opening the necessary ports so people can access your dashboard.

**Think of a firewall like a security guard** - it blocks everything unless you tell it what to allow.

**First, check what firewall you have:**

**For Ubuntu/Debian (most common):**
```bash
sudo ufw status
```

**If it says "Status: active"** - you have UFW firewall

**If it says "Status: inactive"** - firewall is off (you can skip this step, but it's recommended to enable it)

**Enable and configure UFW:**
```bash
sudo ufw allow 3000/tcp    # Allows dashboard access
sudo ufw allow 80/tcp      # Allows HTTP (for websites)
sudo ufw allow 443/tcp     # Allows HTTPS (secure websites)
sudo ufw allow 22/tcp      # Allows SSH (so you can still connect!)
sudo ufw enable            # Turns on the firewall
```

**What each line does:**
- `allow 3000/tcp` = Allows access to port 3000 (your dashboard)
- `allow 80/tcp` = Allows HTTP traffic
- `allow 443/tcp` = Allows HTTPS traffic
- `allow 22/tcp` = Allows SSH (so you don't lock yourself out!)
- `enable` = Turns on the firewall

**For CentOS/RHEL:**
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --reload
```

**⚠️ IMPORTANT:** If you're using a cloud provider (DigitalOcean, AWS, GCP, etc.), you ALSO need to configure their firewall in their control panel:
- DigitalOcean: Networking → Firewalls
- AWS: Security Groups
- GCP: VPC Network → Firewall Rules
- Add rules to allow ports 3000, 80, 443, and 22

---

### Step 9: Access Your Dashboard!

**What you're doing:** Opening your dashboard in a web browser!

**Option 1: Using IP Address (Quick Test)**

1. **Open your web browser** (Chrome, Firefox, etc.)

2. **Go to:** `http://your-vps-ip:3000`
   
   Replace `your-vps-ip` with your actual VPS IP address
   
   **Example:** `http://123.45.67.89:3000`

3. **You should see the login page!** 🎉

**Option 2: Using Domain Name (Recommended)**

If you have a domain, set up Nginx (see the "Production Setup" section below).

**Default Admin Login:**
- **Username:** `admin`
- **Password:** `admin123`

**⚠️ VERY IMPORTANT:** Change this password immediately after logging in!

**How to change password:**
1. Log in
2. Click on your profile/settings
3. Find "Change Password"
4. Enter new password
5. Save

**💡 Forgot your password?** See the "Troubleshooting" section below for instructions on how to reset it without losing data!

---

## 💰 Setting Up Revenue Generation (Linkvertise)

**This is how you earn money from your free hosting!**

### Step 1: Get Your Linkvertise Publisher Account

1. **Go to:** https://publisher.linkvertise.com/
2. **Create an account** (if you don't have one)
   - Click "Sign Up"
   - Fill in your details
   - Verify your email
3. **Get your Publisher Link:**
   - After logging in, you'll see your Publisher Link
   - It looks like: `https://publisher.linkvertise.com/ac/1450748`
   - Copy this link
4. **Note your Publisher ID:**
   - It's the number at the end of the link (like `1450748`)

### Step 2: Configure Linkvertise in Your Dashboard

1. **Log into your dashboard** as admin
   - Go to your dashboard URL
   - Username: `admin`
   - Password: `admin123` (change this!)

2. **Go to Admin Panel:**
   - Look for the shield icon (🛡️) in the sidebar
   - Click it

3. **Open Admin Panel -> Integrations -> Linkvertise**

4. **In "Linkvertise Configuration":**
   - **Publisher Link:** Paste your Publisher Link here
   - **Publisher ID:** Will be filled automatically
   - **Default Coins:** Set how many coins users get per link (e.g., `10`)
   - **Cooldown Timer:** Set time between completions in seconds (e.g., `30`)
   - Click **"Save Configuration"**

**✅ Configuration saved!**

### Step 3: Add Your First Monetized Link

1. **In your Linkvertise dashboard:**
   - Create a new monetized link
   - Copy the Linkvertise URL (looks like `https://linkvertise.com/123456/...`)

2. **Back in your Aether Dashboard:**
   - In the "Manage Links" section
   - Click **"Add New Link"**

3. **Fill in the form:**
   - **Link Title:** "Complete this link" (or any name)
   - **Linkvertise URL:** Paste the monetized link from Linkvertise
     - ⚠️ **NOT** your publisher link!
     - This is the actual link users will complete
   - **Coins Reward:** How many coins users earn (e.g., `15`)
   - **Active:** Check this box (makes it visible to users)

4. **Click "Save Link"**

**✅ Your first monetized link is ready!**

### How Revenue Works

1. **Users visit your dashboard**
2. **They complete Linkvertise links** you've configured
3. **You earn money** from Linkvertise for each completion
4. **Users earn coins** which they can spend on server resources
5. **You control pricing** - set how many coins each resource costs

**It's that simple!** 💰

---

## 🌐 Setting Up Domain & HTTPS (Optional but Recommended)

**This makes your dashboard look more professional and secure.**

### Why Use a Domain?

- Looks professional: `https://dashboard.yoursite.com` vs `http://123.45.67.89:3000`
- More secure with HTTPS (SSL certificate)
- Easier for users to remember

### Step 1: Point Your Domain to Your VPS

**In your domain registrar (where you bought the domain):**

1. **Go to DNS settings**
2. **Add an A record:**
   - **Type:** A
   - **Name:** `dashboard` (or `@` for root domain)
   - **Value:** Your VPS IP address
   - **TTL:** 3600 (or default)

3. **Wait 5-30 minutes** for DNS to propagate

**How to check if it's working:**
```bash
ping dashboard.yourdomain.com
```

If you see your VPS IP, it's working!

### Step 2: Install Nginx

**Nginx** is a web server that handles your domain and HTTPS.

**For Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx -y
```

**For CentOS/RHEL:**
```bash
sudo yum install nginx -y
```

**Check if it's running:**
```bash
sudo systemctl status nginx
```

**You should see "active (running)"**

### Step 3: Create Nginx Configuration

**Step 3.1: Create the config file**
```bash
sudo nano /etc/nginx/sites-available/aether-dashboard
```

**Step 3.2: Paste this configuration:**

**⚠️ Replace `yourdomain.com` with your actual domain!**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        
        # Essential headers for sessions and reverse proxy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Cookie and session support
        proxy_cookie_path / /;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Step 3.3: Save the file:**
- Press `Ctrl + X`
- Press `Y`
- Press `Enter`

**Step 3.4: Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/aether-dashboard /etc/nginx/sites-enabled/
```

**Step 3.5: Test the configuration:**
```bash
sudo nginx -t
```

**You should see:** `syntax is ok` and `test is successful`

**Step 3.6: Reload Nginx:**
```bash
sudo systemctl reload nginx
```

**✅ Nginx is configured!**

### Step 4: Set Up HTTPS (Free SSL Certificate)

**We'll use Let's Encrypt** - it's free and automatic!

**Step 4.1: Install Certbot**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

**Step 4.2: Get SSL Certificate**
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

**Replace `yourdomain.com` with your actual domain!**

**What happens:**
- It will ask for your email (for renewal notices)
- It will ask to agree to terms (type `A` and press Enter)
- It will ask about sharing email (type `Y` or `N` and press Enter)
- It will automatically configure HTTPS!

**✅ Your dashboard now has HTTPS!**

**Step 4.3: Update your `.env` file:**
```bash
nano .env
```

**Change this line:**
```env
USE_HTTPS=true
```

**Save:** `Ctrl + X`, then `Y`, then `Enter`

**Step 4.4: Restart the dashboard:**
```bash
pm2 restart aether-dashboard
```

**✅ Your dashboard is now accessible at `https://yourdomain.com`!**

**💡 Tip:** Certbot automatically renews your certificate. You don't need to do anything!

---

## 🎮 Setting Up Pterodactyl Panel Integration (Optional)

**Note:** This is only needed if you want to provide actual game servers. You can use the dashboard for revenue generation without Pterodactyl!

### What is Pterodactyl?

**Pterodactyl** is a game server management panel. It lets you create and manage Minecraft, CS:GO, and other game servers for your users.

### Getting Your Pterodactyl API Key

1. **Log into your Pterodactyl panel**
   - Go to your Pterodactyl panel URL
   - Log in as admin

2. **Go to API Credentials:**
   - Click **"Admin"** in the sidebar
   - Click **"API Credentials"**

3. **Create New Credentials:**
   - Click **"Create New Credentials"**
   - **Description:** "Aether Dashboard" (or any name)
   - **Permissions:** Select **"Read & Write"**
   - Click **"Create"**

4. **Copy the API Key:**
   - **⚠️ IMPORTANT:** Copy this immediately! You'll only see it once!
   - It looks like: `ptlc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Save it somewhere safe

5. **Copy your Panel URL:**
   - It's the URL you use to access Pterodactyl
   - Example: `https://panel.yoursite.com`

### Configure in Your Dashboard

**Option 1: Via Admin Panel (Easiest)**

1. **Log into your Aether Dashboard** as admin

2. **Go to Admin Panel:**
   - Click the shield icon (🛡️)
   - Click the **"Panel"** tab

3. **Enter your details:**
   - **Panel URL:** Paste your Pterodactyl panel URL
   - **API Key:** Paste your API key

4. **Test the connection:**
   - Click **"Test Connection"**
   - You should see "Connection successful!"

5. **Save:**
   - Click **"Connect"** or **"Save"**

**✅ Pterodactyl is connected!**

**Option 2: Via `.env` File**

1. **Edit the `.env` file:**
   ```bash
   nano .env
   ```

2. **Add these lines:**
   ```env
   PTERODACTYL_URL=https://panel.yoursite.com
   PTERODACTYL_API_KEY=ptlc_xxxxxxxxxxxxx
   ```

3. **Save:** `Ctrl + X`, then `Y`, then `Enter`

4. **Restart the dashboard:**
   ```bash
   pm2 restart aether-dashboard
   ```

**✅ Your users can now create game servers!**

---

## ⚙️ Environment Configuration

**The Aether Dashboard project uses a dual-service architecture with separate environment configuration files.**

### 📋 Overview

The project consists of **two services**, each with its own `.env` file:

1. **Main Dashboard Application** - Located in the root directory (`AETHER_DASHBOARD/.env`)
2. **Discord Bot Service** - Located in `aether-discord-bot/` directory (`AETHER_DASHBOARD/aether-discord-bot/.env`)

**⚠️ Important:** `.env` files are **NOT included in the repository** and must be created manually when setting up the project. They contain sensitive information and should never be committed to Git.

---

### 1. Dashboard `.env` File (Root Directory)

**Location:** `AETHER_DASHBOARD/.env`

**Purpose:** Configuration for the main dashboard Express server.

**Example Configuration:**

```env
# Server Configuration
PORT=3000
NODE_ENV=production
SESSION_SECRET=your_session_secret_here

# HTTPS Configuration (set to 'true' if using HTTPS/SSL)
USE_HTTPS=true

# Discord OAuth (optional - for user login via Discord)
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback

# Pterodactyl Panel (optional - for game server management)
PTERODACTYL_URL=
PTERODACTYL_API_KEY=

# Internal Bot Communication (required for Discord integration)
BOT_API_KEY=secure_internal_key
BOT_API_URL=http://localhost:4000
```

**Variable Descriptions:**

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Port number for the dashboard server (default: 3000) |
| `NODE_ENV` | Yes | Environment mode (`production` or `development`) |
| `SESSION_SECRET` | Yes | Secret key for session encryption (32+ characters, random) |
| `USE_HTTPS` | Yes | Set to `true` if using HTTPS/SSL, `false` for HTTP |
| `DISCORD_CLIENT_ID` | Optional | Discord OAuth application client ID (for Discord login) |
| `DISCORD_CLIENT_SECRET` | Optional | Discord OAuth application client secret |
| `DISCORD_CALLBACK_URL` | Optional | Discord OAuth callback URL |
| `PTERODACTYL_URL` | Optional | Pterodactyl panel URL (e.g., `https://panel.yoursite.com`) |
| `PTERODACTYL_API_KEY` | Optional | Pterodactyl application API key |
| `BOT_API_KEY` | Required* | Shared secret key for bot-dashboard communication (*required if using Discord integration) |
| `BOT_API_URL` | Required* | URL where the Discord bot API is running (*required if using Discord integration) |

**Important Notes:**

- ⚠️ **The dashboard does NOT connect directly to Discord.** It communicates with the Discord bot using `BOT_API_URL` and `BOT_API_KEY`.
- 🔒 **Secrets such as `SESSION_SECRET` and API keys must never be committed to Git.**
- 🔑 **`BOT_API_KEY` must match the same value in the bot's `.env` file** for secure communication.
- 🌐 **`BOT_API_URL` should point to where your Discord bot is running** (default: `http://localhost:4000`).

---

### 2. Discord Bot `.env` File

**Location:** `AETHER_DASHBOARD/aether-discord-bot/.env`

**Purpose:** Configuration for the Discord bot service that handles invite tracking and chat synchronization.

**Example Configuration:**

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DASHBOARD_API_URL=http://localhost:3000
BOT_API_KEY=secure_internal_key
BOT_API_PORT=4000
```

**Variable Descriptions:**

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token from Discord Developer Portal |
| `DASHBOARD_API_URL` | Yes | URL of the dashboard API where bot sends events |
| `BOT_API_KEY` | Yes | Shared secret key for bot-dashboard communication (must match dashboard `.env`) |
| `BOT_API_PORT` | Optional | Port for bot's internal API server (default: 4000) |

**Purpose of Each Variable:**

- **`DISCORD_BOT_TOKEN`**: Used by the bot to authenticate with Discord's API. This token is obtained from the [Discord Developer Portal](https://discord.com/developers/applications).

- **`DASHBOARD_API_URL`**: The dashboard API endpoint where the bot sends events such as:
  - Invite joins (`POST /api/discord/invite-used`)
  - Member leaves (`POST /api/discord/member-left`)
  - Discord chat messages (`POST /api/discord/message`)
  - Heartbeat signals (`POST /api/bot/heartbeat`)

- **`BOT_API_KEY`**: Used to authenticate requests between the bot and dashboard. **This value must match exactly** in both the dashboard `.env` and bot `.env` files.

- **`BOT_API_PORT`**: Port number for the bot's internal Express API server that receives messages from the dashboard.

**⚠️ Important:** The Discord bot token is **never stored in the dashboard** - it remains exclusively in the bot's `.env` file for security.

---

### 3. Communication Flow

**How the two services interact:**

```
┌─────────────────────┐
│  Dashboard Server   │
│   (Port 3000)       │
│                     │
│  - User Management  │
│  - Server Management│
│  - Coin System      │
│  - WebSocket Events │
└──────────┬──────────┘
           │
           │ HTTP API
           │ (BOT_API_KEY)
           │
           ▼
┌─────────────────────┐
│   Discord Bot       │
│   (Port 4000)       │
│                     │
│  - Invite Tracking  │
│  - Message Forwarding│
│  - Heartbeat        │
└──────────┬──────────┘
           │
           │ Discord Gateway
           │ (DISCORD_BOT_TOKEN)
           │
           ▼
┌─────────────────────┐
│   Discord Server    │
│                     │
│  - User Joins/Leaves│
│  - Chat Messages    │
│  - Invite Events    │
└─────────────────────┘
```

**Event Flow Examples:**

**1. Invite Join Flow:**
```
User joins Discord
  → Bot detects invite used
  → Bot sends event to Dashboard API (POST /api/discord/invite-used)
  → Dashboard awards coins to inviter
  → Dashboard updates database
```

**2. Chat Bridge (Discord → Dashboard):**
```
Discord message sent
  → Bot receives message
  → Bot sends to Dashboard API (POST /api/discord/message)
  → Dashboard broadcasts via WebSocket
  → Message appears in Community page
```

**3. Chat Bridge (Dashboard → Discord):**
```
Dashboard user sends message
  → Dashboard API sends request to Bot (POST /bot/send-message)
  → Bot receives message via internal API
  → Bot sends message to Discord channel
  → Message appears in Discord
```

**4. Heartbeat System:**
```
Bot sends heartbeat every 30 seconds
  → Dashboard receives heartbeat (POST /api/bot/heartbeat)
  → Dashboard updates bot status timestamp
  → Admin panel checks status (GET /api/bot/status)
  → Shows 🟢 Online or 🔴 Offline
```

---

### 4. Security Best Practices

**🔒 Protecting Your Secrets:**

1. **Never commit `.env` files to Git** - They are already in `.gitignore`
2. **Use strong, random values** for `SESSION_SECRET` and `BOT_API_KEY`
3. **Keep `DISCORD_BOT_TOKEN` secret** - Only stored in bot's `.env` file
4. **Use HTTPS in production** - Set `USE_HTTPS=true` when using SSL
5. **Restrict file permissions** - Use `chmod 600 .env` to restrict access
6. **Backup `.env` files securely** - Store backups in encrypted storage

**Example secure permissions:**
```bash
chmod 600 .env
chmod 600 aether-discord-bot/.env
```

---

### 5. Setup Checklist

**For Dashboard:**
- [ ] Create `AETHER_DASHBOARD/.env` file
- [ ] Set `SESSION_SECRET` to random 32+ character string
- [ ] Configure `PORT` (default: 3000)
- [ ] Set `USE_HTTPS` based on your setup
- [ ] Add `BOT_API_KEY` and `BOT_API_URL` (if using Discord integration)
- [ ] Optionally configure Discord OAuth and Pterodactyl

**For Discord Bot:**
- [ ] Create `aether-discord-bot/.env` file
- [ ] Set `DISCORD_BOT_TOKEN` from Discord Developer Portal
- [ ] Set `DASHBOARD_API_URL` to your dashboard URL
- [ ] Set `BOT_API_KEY` to **match** the dashboard's `BOT_API_KEY`
- [ ] Optionally set `BOT_API_PORT` (default: 4000)

**Verification:**
- [ ] Both `.env` files exist
- [ ] `BOT_API_KEY` matches in both files
- [ ] `DASHBOARD_API_URL` in bot points to correct dashboard URL
- [ ] All required variables are set
- [ ] File permissions are secure (`chmod 600`)

---

## 🚀 Feature Highlights

### 🤖 Discord Integration (Version 1.4)

**Full Discord bot integration for automated rewards and real-time chat:**

- **Invite Reward System** - Users earn coins automatically when someone joins Discord using their invite link
- **Real-time Chat Sync** - Discord messages appear instantly in dashboard Community page
- **Bidirectional Messaging** - Send messages from dashboard to Discord and vice versa
- **Invite Tracking** - Automatic detection of which invite was used when users join
- **Abuse Protection** - Prevents duplicate rewards; 24-hour cooldown blocks join/leave farming
- **Auto Deduction** - Configurable coin deduction when invited user leaves. Deducts exact coins awarded at join time by default, or a fixed admin-configured amount
- **Live Leaderboard** - Track top inviters with real-time leaderboard
- **WebSocket Integration** - Real-time updates via WebSocket for instant chat synchronization

### ⚡ Server Management Features (Version 1.3)

**These features make your dashboard stand out from competitors!**

### ⚡ Quick Server Actions

Users can **Start/Stop/Restart/Kill** their servers with one click - no need to open Pterodactyl panel!

- Buttons appear directly on the server card
- Real-time status badges show current state
- Works instantly with visual feedback

### 📦 Server Templates (Admin Feature)

Create **pre-configured server templates** for instant deployment:

1. Go to Admin Panel → Templates tab
2. Create a template (e.g., "Minecraft Paper 1.20")
3. Set the egg, RAM, CPU, and storage
4. Users can deploy servers instantly from templates!

**Perfect for:** Common server types, beginner-friendly options

### 📊 Live Stats Dashboard

Users click **"📊 Live Stats"** on any server to see:

- Real-time CPU, RAM, Disk usage (animated gauges)
- Network I/O statistics
- Interactive history graphs (Chart.js)
- Server uptime tracking
- Auto-refreshes every 5 seconds

### 💻 Server Console

Send commands directly from the dashboard:

- Command input with send button
- Command history tracking
- No need to open Pterodactyl panel

**Note:** Full console output requires WebSocket, available via "Open in Panel" button.

### 📁 File Manager

Full file management without leaving the dashboard:

- **Browse** - Navigate folders and files
- **Edit** - Edit text files with syntax-aware editor
- **Create** - Make new files and folders
- **Delete** - Remove files safely
- **Rename** - Rename files and folders
- **Compress** - Create .tar.gz archives
- **Decompress** - Extract archives

### 💾 Backup System

Protect user data with easy backups:

- **Create** - One-click backup creation
- **Download** - Download backups to local machine
- **Restore** - Restore server from backup
- **Delete** - Clean up old backups

### ⏰ Scheduled Tasks

Automate server management:

- **Schedule restarts** - Auto-restart at specific times
- **Run commands** - Execute commands on schedule
- **Create backups** - Scheduled automatic backups
- Cron-style scheduling (minute, hour, day, etc.)

### 🗃️ Database Management

For servers that need databases:

- **Create** - Create MySQL databases
- **Rotate Password** - Generate new secure passwords
- **Delete** - Remove unused databases
- Copy connection strings easily

### 🚨 Usage Alerts

Automatic warnings when resources are high:

- ⚠️ **Warning** at 80% usage (yellow)
- 🔴 **Critical** at 90% usage (red)
- Applies to CPU, RAM, and Disk
- Helps users manage resources before issues occur

---

## 🎨 Managing Your Hosting Business

### For You (Administrator)

**Access Admin Panel:**
- Click the shield icon (🛡️) in the sidebar
- You'll see several tabs:

**1. User Management:**
- See all your users
- Edit user details
- Delete users
- Monitor user activity

**2. Server Management:**
- See all servers created by users
- Delete servers if needed
- Monitor resource usage

**3. Coin Management:**
- Add or remove coins from any user
- Search users by username
- Track coin distribution

**4. Linkvertise Management:**
- Configure publisher settings
- Add/edit/delete monetized links
- Set coin rewards
- Monitor link completion rates

**5. Store Management:**
- Set prices for RAM, CPU, Storage
- Set price for Server Slots
- Adjust pricing to optimize revenue

**6. Panel Configuration:**
- Connect to Pterodactyl panel
- Manage eggs and allocations
- Sync users to Pterodactyl

### For Your Users

Your users will:
1. **Sign Up** - Create account or use Discord login
2. **Earn Coins** - Complete Linkvertise links you've configured
3. **Buy Resources** - Spend coins on RAM, CPU, Storage, Server Slots
4. **Create Servers** - Use purchased resources to create game servers
5. **Manage Servers** - View and manage their servers

---

## 🔒 Security Checklist for Production

Before going live, make sure you've completed:

- [ ] Changed default admin password
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Used a strong `SESSION_SECRET` (32+ characters, random)
- [ ] Set up HTTPS/SSL certificate (Let's Encrypt is free)
- [ ] Configured firewall (only allow ports 80, 443, and SSH)
- [ ] Set up regular backups of `database.db` - See [Backup & Recovery Guide](BACKUP_RECOVERY.md)
- [ ] Updated Node.js to latest LTS version
- [ ] Using PM2 to keep app running
- [ ] Set up monitoring/logging
- [ ] Restricted admin panel access (if possible)

---

## ❓ Troubleshooting

**Having issues?** Check out our comprehensive [Troubleshooting Guide](TROUBLESHOOTING.md) for solutions to common problems:

- Node.js installation issues
- Port conflicts
- Connection problems
- Login/session issues
- Password recovery
- Database issues
- And much more!

👉 **[View Troubleshooting Guide →](TROUBLESHOOTING.md)**

---

## 📦 Updating the Dashboard

**Want to update to the latest version?** 

👉 **[See the Update Guide (UPDATES.md)](UPDATES.md)** for:
- Step-by-step update instructions
- Update checklist
- Version changelog
- Troubleshooting update issues

**Quick Update (if installed via GitHub):**
```bash
cd AETHER_DASHBOARD
git pull origin main
npm install
pm2 restart aether-dashboard
```

**⚠️ Always backup your `database.db` and `.env` files before updating!**

👉 **[See the Backup & Recovery Guide](BACKUP_RECOVERY.md)** for detailed backup instructions and how to restore if something goes wrong.

---

## 📖 Need More Help?

1. **Check this README** - Most questions are answered here
2. **Check the Admin Guide** - [ADMIN_GUIDE.md](ADMIN_GUIDE.md) for full admin panel walkthrough
3. **Check the Troubleshooting Guide** - [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions
4. **Check the Update Guide** - [UPDATES.md](UPDATES.md) for update instructions
5. **Check the Backup Guide** - [BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) for backup and recovery instructions

---

## 📝 Quick Reference

### Default Admin Login
- **Username:** `admin`
- **Password:** `admin123`
- ⚠️ **Change immediately after first login!**

### Important Commands
```bash
pm2 list                    # See running apps
pm2 logs aether-dashboard   # See logs
pm2 restart aether-dashboard  # Restart
pm2 stop aether-dashboard     # Stop
pm2 start server.js --name aether-dashboard  # Start
```

### Important Files
- **`.env`** - Dashboard configuration (keep secret!) - See [Environment Configuration](#-environment-configuration)
- **`aether-discord-bot/.env`** - Discord bot configuration (keep secret!) - See [Environment Configuration](#-environment-configuration)
- **`database.db`** - All your data (backup regularly!) - See [Backup & Recovery Guide](BACKUP_RECOVERY.md)
- **`reset-admin-password.js`** - Password reset script (use if you forget admin password)

**⚠️ Note:** The project uses two separate `.env` files - one for the dashboard and one for the Discord bot. See the [Environment Configuration](#-environment-configuration) section for details.

---

## 📝 Summary - Quick Start Checklist

**To get your dashboard running:**

- [ ] Connected to VPS via SSH
- [ ] Updated system (`sudo apt update && sudo apt upgrade -y`)
- [ ] Installed Node.js (checked with `node --version`)
- [ ] Uploaded/cloned dashboard code
- [ ] Installed dependencies (`npm install`)
- [ ] Created dashboard `.env` file with configuration (see [Environment Configuration](#-environment-configuration))
- [ ] Created Discord bot `.env` file (if using Discord integration)
- [ ] Started with PM2 (`pm2 start server.js --name aether-dashboard`)
- [ ] Configured firewall
- [ ] Can access dashboard in browser
- [ ] Changed admin password
- [ ] Configured Linkvertise for revenue

**That's it!** 🎉 Your free hosting revenue platform is ready!

---

## 📄 License

MIT License - Feel free to use, modify, and distribute!

---

**Made with ❤️ for free hosting providers. Start earning revenue today!** 🚀💰

**Version 1.5.8** - Production Ready ✅

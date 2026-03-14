#!/bin/bash

# Aether Dashboard Installation Script
# Production-ready installer for Ubuntu 22.04 / Debian systems
# Compatible with direct GitHub execution: bash <(curl -s https://raw.githubusercontent.com/<username>/AETHER_DASHBOARD/main/install.sh)

set -e

# Configuration
INSTALL_DIR="/opt/aether-dashboard"
LOG_FILE="/var/log/aether-installer.log"
REPO_URL="https://github.com/Shaf2665/AETHER_DASHBOARD.git"

# Enable logging
mkdir -p /var/log
exec > >(tee -a "$LOG_FILE") 2>&1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# STEP 1 — Root Privilege Check
check_root() {
    log_info "Checking root privileges..."
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run this installer as root."
        exit 1
    fi
    log_success "Root privileges confirmed"
}

# STEP 2 — Prevent Reinstallation
check_existing_installation() {
    log_info "Checking for existing installation..."
    if [ -d "$INSTALL_DIR" ]; then
        log_error "Aether Dashboard is already installed at $INSTALL_DIR"
        log_info "Use update.sh instead."
        exit 1
    fi
    log_success "No existing installation found"
}

# STEP 3 — Clone Repository
clone_repository() {
    log_info "Cloning repository..."
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        log_info "Installing git..."
        apt-get update -qq
        apt-get install -y git
    fi
    
    git clone "$REPO_URL" "$INSTALL_DIR" || {
        log_error "Failed to clone repository"
        exit 1
    }
    
    cd "$INSTALL_DIR"
    log_success "Repository cloned successfully"
}

# STEP 4 — System Checks
check_system_requirements() {
    log_info "Checking system requirements..."
    
    # Check required tools
    local missing_tools=()
    
    for tool in curl git openssl; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_info "Installing missing tools: ${missing_tools[*]}"
        apt-get update -qq
        apt-get install -y "${missing_tools[@]}"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_info "Node.js not found. Installing Node.js 20 LTS..."
        install_nodejs
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            log_warning "Node.js version is less than 18. Installing Node.js 20 LTS..."
            install_nodejs
        else
            log_success "Node.js $(node --version) is installed"
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install Node.js first."
        exit 1
    fi
    
    log_success "System requirements met"
}

install_nodejs() {
    log_info "Installing Node.js 20 LTS from NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_success "Node.js $(node --version) installed"
}

# STEP 5 — Install System Dependencies
install_system_dependencies() {
    log_info "Installing system dependencies..."
    
    apt-get update -qq
    
    local packages=("nginx" "certbot" "python3-certbot-nginx" "ufw" "build-essential")
    local to_install=()
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            to_install+=("$package")
        fi
    done
    
    if [ ${#to_install[@]} -ne 0 ]; then
        log_info "Installing packages: ${to_install[*]}"
        apt-get install -y "${to_install[@]}"
    else
        log_info "All required packages are already installed"
    fi
    
    # Install PM2 globally
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        npm install -g pm2
        log_success "PM2 installed"
    else
        log_info "PM2 is already installed"
    fi
    
    log_success "System dependencies installed"
}

# STEP 6 — Configure Firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Check if ufw is active
    if ufw status | grep -q "Status: inactive"; then
        log_info "Enabling firewall..."
        ufw --force enable
    fi
    
    # Allow required ports
    ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
    ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
    ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
    
    log_success "Firewall configured"
}

# STEP 7 — Interactive Setup
interactive_setup() {
    log_info "Starting interactive setup..."
    
    # Get domain name
    while true; do
        read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN
        if [[ "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]; then
            break
        else
            log_error "Invalid domain format. Please try again."
        fi
    done
    
    # Get Discord Bot Token
    read -p "Enter your Discord Bot Token: " DISCORD_BOT_TOKEN
    if [ -z "$DISCORD_BOT_TOKEN" ]; then
        log_warning "Discord Bot Token is empty. You can add it later in $INSTALL_DIR/aether-discord-bot/.env"
    fi
    
    # Get dashboard port
    read -p "Enter dashboard port (default: 3000): " DASHBOARD_PORT
    DASHBOARD_PORT=${DASHBOARD_PORT:-3000}
    
    # Validate port
    if ! [[ "$DASHBOARD_PORT" =~ ^[0-9]+$ ]] || [ "$DASHBOARD_PORT" -lt 1 ] || [ "$DASHBOARD_PORT" -gt 65535 ]; then
        log_error "Invalid port number. Using default 3000"
        DASHBOARD_PORT=3000
    fi
    
    log_success "Configuration collected"
}

# STEP 8 — Detect Server IP
detect_server_ip() {
    log_info "Detecting server IP address..."
    
    SERVER_IP=$(curl -s ifconfig.me || curl -s ifconfig.co || curl -s icanhazip.com)
    
    if [ -z "$SERVER_IP" ]; then
        log_error "Could not detect server IP address"
        read -p "Enter your server IP address manually: " SERVER_IP
    fi
    
    log_success "Server IP: $SERVER_IP"
    
    echo ""
    log_info "DNS Configuration Instructions:"
    echo "=================================="
    echo "Create an A record in your DNS settings:"
    echo ""
    echo "Type: A"
    echo "Name: $(echo $DOMAIN | cut -d'.' -f1)"
    echo "Value: $SERVER_IP"
    echo ""
    echo "For root domain (example.com), use '@' as the name"
    echo ""
    
    read -p "Press Enter once you have configured DNS..."
}

# STEP 9 — Verify DNS
verify_dns() {
    log_info "Verifying DNS propagation..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local resolved_ip=$(dig +short "$DOMAIN" | tail -n1)
        
        if [ "$resolved_ip" = "$SERVER_IP" ]; then
            log_success "DNS verified: $DOMAIN -> $SERVER_IP"
            return 0
        fi
        
        if [ -n "$resolved_ip" ] && [ "$resolved_ip" != "$SERVER_IP" ]; then
            log_warning "DNS resolved to $resolved_ip, expected $SERVER_IP"
        fi
        
        log_info "Waiting for DNS propagation... (attempt $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    log_warning "DNS verification timeout. Continuing anyway..."
    read -p "Press Enter to continue..."
}

# STEP 10 — Generate Secure Secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    SESSION_SECRET=$(openssl rand -hex 32)
    BOT_API_KEY=$(openssl rand -hex 32)
    
    log_success "Secrets generated"
}

# STEP 11 — Create Environment Files
create_env_files() {
    log_info "Creating environment files..."
    
    cd "$INSTALL_DIR"
    
    # Create root .env file
    if [ -f ".env" ]; then
        log_warning ".env file already exists"
        read -p "Overwrite existing .env file? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            log_info "Skipping .env file creation"
            return
        fi
    fi
    
    cat > .env << EOF
# Server Configuration
PORT=$DASHBOARD_PORT
NODE_ENV=production
SESSION_SECRET=$SESSION_SECRET

# HTTPS Configuration (set to 'true' if using HTTPS/SSL)
USE_HTTPS=true

# Discord OAuth (optional - for user login via Discord)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_CALLBACK_URL=https://$DOMAIN/auth/discord/callback

# Pterodactyl Panel (optional - for game server management)
PTERODACTYL_URL=
PTERODACTYL_API_KEY=

# Internal Bot Communication (required for Discord integration)
BOT_API_KEY=$BOT_API_KEY
BOT_API_URL=http://localhost:4000
EOF
    
    log_success "Root .env file created"
    
    # Create bot .env file
    mkdir -p aether-discord-bot
    
    if [ -f "aether-discord-bot/.env" ]; then
        log_warning "Bot .env file already exists"
        read -p "Overwrite existing bot .env file? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            log_info "Skipping bot .env file creation"
            return
        fi
    fi
    
    cat > aether-discord-bot/.env << EOF
# Discord Bot Configuration
DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN
DASHBOARD_API_URL=https://$DOMAIN
BOT_API_KEY=$BOT_API_KEY
BOT_API_PORT=4000
EOF
    
    # Set secure permissions
    chmod 600 .env
    chmod 600 aether-discord-bot/.env
    
    log_success "Bot .env file created"
}

# STEP 12 — Install Node Dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR"
    
    log_info "Installing dashboard dependencies..."
    npm install --production
    
    log_info "Installing bot dependencies..."
    cd aether-discord-bot
    npm install --production
    cd ..
    
    log_success "Dependencies installed"
}

# STEP 13 — Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    local nginx_config="/etc/nginx/sites-available/aether-dashboard"
    
    if [ -f "$nginx_config" ]; then
        log_warning "Nginx configuration already exists"
        read -p "Overwrite existing Nginx configuration? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            log_info "Skipping Nginx configuration"
            return
        fi
    fi
    
    cat > "$nginx_config" << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:$DASHBOARD_PORT;
        proxy_http_version 1.1;
        
        # Essential headers for sessions and reverse proxy
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Cookie and session support
        proxy_cookie_path / /;
        
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Enable site
    ln -sf "$nginx_config" /etc/nginx/sites-enabled/aether-dashboard
    
    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx configured and reloaded"
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

# STEP 14 — Enable SSL
enable_ssl() {
    log_info "Enabling SSL with Let's Encrypt..."
    
    if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect; then
        log_success "SSL certificate installed"
        
        # Update .env to use HTTPS
        sed -i 's/USE_HTTPS=false/USE_HTTPS=true/' "$INSTALL_DIR/.env"
        
        # Enable automatic renewal
        systemctl enable certbot.timer
        log_success "SSL automatic renewal enabled"
    else
        log_warning "SSL certificate installation failed. You can run certbot manually later."
    fi
}

# STEP 15 — Start Services
start_services() {
    log_info "Starting services..."
    
    cd "$INSTALL_DIR"
    
    # Start dashboard
    log_info "Starting dashboard..."
    pm2 start server.js --name aether-dashboard || {
        log_error "Failed to start dashboard"
        exit 1
    }
    
    # Start Discord bot
    if [ -n "$DISCORD_BOT_TOKEN" ]; then
        log_info "Starting Discord bot..."
        cd aether-discord-bot
        pm2 start bot.js --name aether-discord-bot || {
            log_warning "Failed to start Discord bot. You can start it manually later."
        }
        cd ..
    else
        log_warning "Discord bot token not provided. Skipping bot startup."
    fi
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup
    pm2 startup systemd -u root --hp /root | grep -v "PM2" | bash || true
    
    log_success "Services started"
}

# STEP 16 — Verify Installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check PM2 status
    if pm2 list | grep -q "aether-dashboard"; then
        log_success "Dashboard service is running"
    else
        log_error "Dashboard service is not running"
    fi
    
    # Check Nginx status
    if systemctl is-active --quiet nginx; then
        log_success "Nginx is running"
    else
        log_error "Nginx is not running"
    fi
    
    # Test dashboard endpoint
    if curl -f -s "http://localhost:$DASHBOARD_PORT" > /dev/null; then
        log_success "Dashboard is responding"
    else
        log_warning "Dashboard endpoint test failed"
    fi
}

# STEP 17 — Completion Message
display_completion() {
    echo ""
    echo "=================================="
    echo "Aether Dashboard Installed"
    echo "=================================="
    echo ""
    echo "Dashboard URL:"
    echo "https://$DOMAIN"
    echo ""
    echo "Services running:"
    echo "✓ Dashboard"
    if [ -n "$DISCORD_BOT_TOKEN" ]; then
        echo "✓ Discord Bot"
    fi
    echo "✓ Nginx"
    echo "✓ SSL enabled"
    echo ""
    echo "Useful commands:"
    echo "  pm2 status"
    echo "  pm2 logs"
    echo "  pm2 restart aether-dashboard"
    echo "  pm2 restart aether-discord-bot"
    echo ""
    echo "Installer logs saved to:"
    echo "$LOG_FILE"
    echo ""
    log_success "Installation completed successfully!"
}

# Main installation flow
main() {
    echo ""
    log_info "Starting Aether Dashboard installation..."
    echo ""
    
    check_root
    check_existing_installation
    clone_repository
    check_system_requirements
    install_system_dependencies
    configure_firewall
    interactive_setup
    detect_server_ip
    verify_dns
    generate_secrets
    create_env_files
    install_dependencies
    configure_nginx
    enable_ssl
    start_services
    verify_installation
    display_completion
}

# Run main function
main

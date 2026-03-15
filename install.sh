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

# Safe apt-get wrapper with error handling
safe_apt_install() {
    local packages=("$@")
    log_info "Updating package list..."
    if ! apt-get update -qq; then
        log_error "Failed to update package list"
        return 1
    fi
    
    log_info "Installing packages: ${packages[*]}"
    if ! DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"; then
        log_error "Failed to install packages: ${packages[*]}"
        return 1
    fi
    return 0
}

# Safe curl with timeout
safe_curl() {
    local url="$1"
    local timeout="${2:-10}"
    curl -s --max-time "$timeout" --connect-timeout 5 "$url" 2>/dev/null || return 1
}

# Check if port is available
check_port() {
    local port="$1"
    if command -v netstat &> /dev/null; then
        if netstat -tuln | grep -q ":$port "; then
            return 1
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln | grep -q ":$port "; then
            return 1
        fi
    fi
    return 0
}

# Validate IP address format
validate_ip() {
    local ip="$1"
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -ra ADDR <<< "$ip"
        for i in "${ADDR[@]}"; do
            if [[ "$i" -gt 255 ]]; then
                return 1
            fi
        done
        return 0
    fi
    return 1
}

# Validate email format
validate_email() {
    local email="$1"
    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    fi
    return 1
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
        if ! safe_apt_install git; then
            log_error "Failed to install git"
            exit 1
        fi
    fi
    
    # Check network connectivity
    if ! safe_curl "https://github.com" 5; then
        log_error "Cannot reach GitHub. Please check your internet connection."
        exit 1
    fi
    
    if ! git clone "$REPO_URL" "$INSTALL_DIR"; then
        log_error "Failed to clone repository"
        log_info "Please check:"
        log_info "  1. Internet connection"
        log_info "  2. Repository URL is correct: $REPO_URL"
        log_info "  3. Repository is accessible"
        exit 1
    fi
    
    cd "$INSTALL_DIR" || {
        log_error "Failed to change to installation directory"
        exit 1
    }
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
    
    # Add dnsutils for dig command
    if ! command -v dig &> /dev/null; then
        missing_tools+=("dnsutils")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_info "Installing missing tools: ${missing_tools[*]}"
        if ! safe_apt_install "${missing_tools[@]}"; then
            log_error "Failed to install required tools"
            exit 1
        fi
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
    
    # Download and verify NodeSource script
    local nodesource_script="/tmp/nodesource_setup.sh"
    if ! safe_curl "https://deb.nodesource.com/setup_20.x" 30 > "$nodesource_script"; then
        log_error "Failed to download NodeSource setup script"
        exit 1
    fi
    
    # Execute script with error handling
    if ! bash "$nodesource_script"; then
        log_error "Failed to execute NodeSource setup script"
        rm -f "$nodesource_script"
        exit 1
    fi
    rm -f "$nodesource_script"
    
    # Install Node.js
    if ! safe_apt_install nodejs; then
        log_error "Failed to install Node.js"
        exit 1
    fi
    
    # Verify installation
    if ! command -v node &> /dev/null; then
        log_error "Node.js installation verification failed"
        exit 1
    fi
    
    log_success "Node.js $(node --version) installed"
}

# STEP 5 — Install System Dependencies
install_system_dependencies() {
    log_info "Installing system dependencies..."
    
    local packages=("nginx" "certbot" "python3-certbot-nginx" "ufw" "build-essential")
    local to_install=()
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            to_install+=("$package")
        fi
    done
    
    if [ ${#to_install[@]} -ne 0 ]; then
        log_info "Installing packages: ${to_install[*]}"
        if ! safe_apt_install "${to_install[@]}"; then
            log_error "Failed to install system dependencies"
            exit 1
        fi
    else
        log_info "All required packages are already installed"
    fi
    
    # Install PM2 globally
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        if ! npm install -g pm2; then
            log_error "Failed to install PM2"
            exit 1
        fi
        log_success "PM2 installed"
    else
        log_info "PM2 is already installed"
    fi
    
    log_success "System dependencies installed"
}

# STEP 6 — Configure Firewall
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Check if ufw is available
    if ! command -v ufw &> /dev/null; then
        log_warning "ufw is not installed. Skipping firewall configuration."
        return 0
    fi
    
    # Check if ufw is active
    if ufw status | grep -q "Status: inactive"; then
        log_info "Enabling firewall..."
        if ! ufw --force enable; then
            log_warning "Failed to enable firewall. Continuing anyway..."
            return 0
        fi
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
    
    # Get domain name with better validation
    while true; do
        read -p "Enter your domain name (e.g., dashboard.example.com): " DOMAIN
        DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]' | xargs)
        
        # Improved domain validation (allows subdomains)
        if [[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
            # Additional check: ensure it's not just numbers
            if [[ ! "$DOMAIN" =~ ^[0-9.]+$ ]]; then
                break
            else
                log_error "Domain cannot be only numbers. Please enter a valid domain name."
            fi
        else
            log_error "Invalid domain format. Please try again."
            log_info "Example: dashboard.example.com or sub.dashboard.example.com"
        fi
    done
    
    # Get Discord Bot Token
    while true; do
        read -p "Enter your Discord Bot Token (or press Enter to skip): " DISCORD_BOT_TOKEN
        if [ -z "$DISCORD_BOT_TOKEN" ]; then
            log_warning "Discord Bot Token is empty. You can add it later in $INSTALL_DIR/aether-discord-bot/.env"
            break
        elif [[ "$DISCORD_BOT_TOKEN" =~ ^[A-Za-z0-9._-]{59,}$ ]]; then
            break
        else
            log_error "Invalid Discord Bot Token format. Please try again or press Enter to skip."
        fi
    done
    
    # Get dashboard port with validation
    while true; do
        read -p "Enter dashboard port (default: 3000): " DASHBOARD_PORT
        DASHBOARD_PORT=${DASHBOARD_PORT:-3000}
        
        # Validate port
        if ! [[ "$DASHBOARD_PORT" =~ ^[0-9]+$ ]] || [ "$DASHBOARD_PORT" -lt 1 ] || [ "$DASHBOARD_PORT" -gt 65535 ]; then
            log_error "Invalid port number. Must be between 1 and 65535."
            continue
        fi
        
        # Check if port is available
        if ! check_port "$DASHBOARD_PORT"; then
            log_warning "Port $DASHBOARD_PORT is already in use."
            read -p "Continue anyway? (y/N): " continue_anyway
            if [[ "$continue_anyway" =~ ^[Yy]$ ]]; then
                break
            fi
        else
            break
        fi
    done
    
    log_success "Configuration collected"
}

# STEP 8 — Detect Server IP
detect_server_ip() {
    log_info "Detecting server IP address..."
    
    SERVER_IP=$(safe_curl "ifconfig.me" 10 || safe_curl "ifconfig.co" 10 || safe_curl "icanhazip.com" 10)
    
    if [ -z "$SERVER_IP" ]; then
        log_error "Could not detect server IP address automatically"
        while true; do
            read -p "Enter your server IP address manually: " SERVER_IP
            SERVER_IP=$(echo "$SERVER_IP" | xargs)
            if validate_ip "$SERVER_IP"; then
                break
            else
                log_error "Invalid IP address format. Please try again."
            fi
        done
    else
        # Validate detected IP
        if ! validate_ip "$SERVER_IP"; then
            log_warning "Detected IP format seems invalid: $SERVER_IP"
            read -p "Enter your server IP address manually: " SERVER_IP
            while ! validate_ip "$SERVER_IP"; do
                log_error "Invalid IP address format. Please try again."
                read -p "Enter your server IP address manually: " SERVER_IP
            done
        fi
    fi
    
    log_success "Server IP: $SERVER_IP"
    
    echo ""
    log_info "DNS Configuration Instructions:"
    echo "=================================="
    echo "Create an A record in your DNS settings:"
    echo ""
    echo "Type: A"
    echo "Name: $(echo "$DOMAIN" | cut -d'.' -f1)"
    echo "Value: $SERVER_IP"
    echo ""
    echo "For root domain (example.com), use '@' as the name"
    echo "For subdomains (sub.example.com), use 'sub' as the name"
    echo ""
    
    read -p "Press Enter once you have configured DNS..."
}

# STEP 9 — Verify DNS
verify_dns() {
    log_info "Verifying DNS propagation..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local resolved_ip=$(dig +short "$DOMAIN" 2>/dev/null | tail -n1 | grep -E "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$")
        
        if [ "$resolved_ip" = "$SERVER_IP" ]; then
            log_success "DNS verified: $DOMAIN -> $SERVER_IP"
            return 0
        fi
        
        if [ -n "$resolved_ip" ] && [ "$resolved_ip" != "$SERVER_IP" ]; then
            log_warning "DNS resolved to $resolved_ip, expected $SERVER_IP"
        fi
        
        log_info "Waiting for DNS propagation... (attempt $attempt/$max_attempts)"
        if [ $attempt -lt $max_attempts ]; then
            sleep 10
        fi
        attempt=$((attempt + 1))
    done
    
    log_warning "DNS verification timeout after $max_attempts attempts."
    log_info "This might be normal if DNS hasn't propagated yet."
    read -p "Continue anyway? (y/N): " continue_dns
    if [[ ! "$continue_dns" =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled. Please configure DNS and run the installer again."
        exit 0
    fi
}

# STEP 10 — Generate Secure Secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    if ! command -v openssl &> /dev/null; then
        log_error "openssl is not available. Cannot generate secrets."
        exit 1
    fi
    
    SESSION_SECRET=$(openssl rand -hex 32)
    BOT_API_KEY=$(openssl rand -hex 32)
    
    if [ -z "$SESSION_SECRET" ] || [ -z "$BOT_API_KEY" ]; then
        log_error "Failed to generate secrets"
        exit 1
    fi
    
    log_success "Secrets generated"
}

# STEP 11 — Create Environment Files
create_env_files() {
    log_info "Creating environment files..."
    
    cd "$INSTALL_DIR" || {
        log_error "Failed to change to installation directory"
        exit 1
    }
    
    # Create root .env file
    local env_created=false
    if [ -f ".env" ]; then
        log_warning ".env file already exists"
        read -p "Overwrite existing .env file? (y/N): " overwrite
        if [[ "$overwrite" =~ ^[Yy]$ ]]; then
            env_created=true
        else
            log_info "Skipping root .env file creation"
            log_warning "You may need to manually configure .env file with required variables"
        fi
    else
        env_created=true
    fi
    
    if [ "$env_created" = true ]; then
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
        chmod 600 .env
        log_success "Root .env file created"
    fi
    
    # Create bot .env file
    mkdir -p aether-discord-bot
    
    local bot_env_created=false
    if [ -f "aether-discord-bot/.env" ]; then
        log_warning "Bot .env file already exists"
        read -p "Overwrite existing bot .env file? (y/N): " overwrite
        if [[ "$overwrite" =~ ^[Yy]$ ]]; then
            bot_env_created=true
        else
            log_info "Skipping bot .env file creation"
            log_warning "You may need to manually configure bot .env file"
        fi
    else
        bot_env_created=true
    fi
    
    if [ "$bot_env_created" = true ]; then
        cat > aether-discord-bot/.env << EOF
# Discord Bot Configuration
DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN
DASHBOARD_API_URL=https://$DOMAIN
BOT_API_KEY=$BOT_API_KEY
BOT_API_PORT=4000
EOF
        chmod 600 aether-discord-bot/.env
        log_success "Bot .env file created"
    fi
    
    # Warn if critical files weren't created
    if [ "$env_created" != true ] || [ "$bot_env_created" != true ]; then
        log_warning "Some environment files were not created. Services may not start correctly."
        read -p "Continue anyway? (y/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            log_info "Installation cancelled. Please configure environment files and run again."
            exit 0
        fi
    fi
}

# STEP 12 — Install Node Dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR" || {
        log_error "Failed to change to installation directory"
        exit 1
    }
    
    log_info "Installing dashboard dependencies..."
    if ! npm install --production; then
        log_error "Failed to install dashboard dependencies"
        exit 1
    fi
    
    log_info "Installing bot dependencies..."
    cd aether-discord-bot || {
        log_error "Bot directory not found"
        exit 1
    }
    if ! npm install --production; then
        log_error "Failed to install bot dependencies"
        exit 1
    fi
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
    if ! nginx -t; then
        log_error "Nginx configuration test failed"
        log_info "Please check the configuration file: $nginx_config"
        exit 1
    fi
    
    if ! systemctl reload nginx; then
        log_error "Failed to reload Nginx"
        exit 1
    fi
    
    log_success "Nginx configured and reloaded"
}

# STEP 14 — Enable SSL
enable_ssl() {
    log_info "Enabling SSL with Let's Encrypt..."
    
    # Get email for SSL certificate
    local ssl_email=""
    while true; do
        read -p "Enter email for SSL certificate notifications (required for Let's Encrypt): " ssl_email
        ssl_email=$(echo "$ssl_email" | xargs)
        if [ -z "$ssl_email" ]; then
            log_error "Email is required for SSL certificate"
            continue
        fi
        if validate_email "$ssl_email"; then
            break
        else
            log_error "Invalid email format. Please try again."
        fi
    done
    
    log_info "Requesting SSL certificate for $DOMAIN..."
    if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$ssl_email" --redirect; then
        log_success "SSL certificate installed"
        
        # Update .env to use HTTPS
        if [ -f "$INSTALL_DIR/.env" ]; then
            sed -i 's/USE_HTTPS=false/USE_HTTPS=true/' "$INSTALL_DIR/.env" || true
        fi
        
        # Enable automatic renewal
        if systemctl enable certbot.timer 2>/dev/null; then
            log_success "SSL automatic renewal enabled"
        else
            log_warning "Could not enable automatic renewal. You may need to set it up manually."
        fi
    else
        log_warning "SSL certificate installation failed."
        log_info "You can run certbot manually later with:"
        log_info "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
        read -p "Continue without SSL? (y/N): " continue_no_ssl
        if [[ ! "$continue_no_ssl" =~ ^[Yy]$ ]]; then
            log_info "Installation cancelled. Please fix SSL issues and run again."
            exit 0
        fi
    fi
}

# STEP 15 — Start Services
start_services() {
    log_info "Starting services..."
    
    cd "$INSTALL_DIR" || {
        log_error "Failed to change to installation directory"
        exit 1
    }
    
    # Check if server.js exists
    if [ ! -f "server.js" ]; then
        log_error "server.js not found in installation directory"
        exit 1
    fi
    
    # Start dashboard
    log_info "Starting dashboard..."
    if ! pm2 start server.js --name aether-dashboard; then
        log_error "Failed to start dashboard"
        log_info "Check logs with: pm2 logs aether-dashboard"
        exit 1
    fi
    
    # Start Discord bot
    if [ -n "$DISCORD_BOT_TOKEN" ] && [ -f "aether-discord-bot/bot.js" ]; then
        log_info "Starting Discord bot..."
        cd aether-discord-bot || {
            log_warning "Bot directory not found. Skipping bot startup."
            cd ..
            return 0
        }
        if ! pm2 start bot.js --name aether-discord-bot; then
            log_warning "Failed to start Discord bot. You can start it manually later with:"
            log_info "  cd $INSTALL_DIR/aether-discord-bot && pm2 start bot.js --name aether-discord-bot"
        fi
        cd ..
    else
        log_warning "Discord bot token not provided or bot.js not found. Skipping bot startup."
    fi
    
    # Save PM2 configuration
    if ! pm2 save; then
        log_warning "Failed to save PM2 configuration"
    fi
    
    # Setup PM2 startup with better error handling
    log_info "Configuring PM2 startup..."
    local startup_cmd=$(pm2 startup systemd -u root --hp /root 2>/dev/null | grep -v "PM2" | tail -n1)
    if [ -n "$startup_cmd" ]; then
        if echo "$startup_cmd" | grep -q "sudo"; then
            # Extract the actual command after sudo
            startup_cmd=$(echo "$startup_cmd" | sed 's/sudo //')
        fi
        if bash -c "$startup_cmd" 2>/dev/null; then
            log_success "PM2 startup configured"
        else
            log_warning "Failed to configure PM2 startup. You may need to run it manually."
            log_info "Run: pm2 startup systemd -u root --hp /root"
        fi
    else
        log_warning "Could not generate PM2 startup command"
    fi
    
    log_success "Services started"
}

# STEP 16 — Verify Installation
verify_installation() {
    log_info "Verifying installation..."
    
    local all_good=true
    
    # Check PM2 status
    if pm2 list | grep -q "aether-dashboard"; then
        local dashboard_status=$(pm2 jlist | grep -A 5 '"name":"aether-dashboard"' | grep '"pm2_env":{"status":"online"' || echo "")
        if [ -n "$dashboard_status" ]; then
            log_success "Dashboard service is running"
        else
            log_error "Dashboard service is not running"
            all_good=false
        fi
    else
        log_error "Dashboard service not found in PM2"
        all_good=false
    fi
    
    # Check Nginx status
    if systemctl is-active --quiet nginx; then
        log_success "Nginx is running"
    else
        log_error "Nginx is not running"
        all_good=false
    fi
    
    # Test dashboard endpoint
    if curl -f -s --max-time 5 "http://localhost:$DASHBOARD_PORT" > /dev/null 2>&1; then
        log_success "Dashboard is responding"
    else
        log_warning "Dashboard endpoint test failed (this might be normal if the service is still starting)"
        log_info "Check logs with: pm2 logs aether-dashboard"
    fi
    
    if [ "$all_good" != true ]; then
        log_warning "Some verification checks failed. Please review the logs."
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

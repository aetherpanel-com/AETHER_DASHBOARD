#!/bin/bash

# Aether Dashboard Update Script
# Safely updates the dashboard to the latest version

set -e

# Configuration
INSTALL_DIR="/opt/aether-dashboard"
LOG_FILE="/var/log/aether-installer.log"

# Enable logging
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

# Check if installation exists
check_installation() {
    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "Aether Dashboard is not installed at $INSTALL_DIR"
        log_info "Please run install.sh first"
        exit 1
    fi
}

# Backup configuration files
backup_config() {
    log_info "Backing up configuration files..."
    
    local backup_dir="$INSTALL_DIR/backups"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    mkdir -p "$backup_dir"
    
    if [ -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env" "$backup_dir/.env.$timestamp"
        log_success "Dashboard .env backed up"
    fi
    
    if [ -f "$INSTALL_DIR/aether-discord-bot/.env" ]; then
        cp "$INSTALL_DIR/aether-discord-bot/.env" "$backup_dir/bot.env.$timestamp"
        log_success "Bot .env backed up"
    fi
    
    if [ -f "$INSTALL_DIR/database.db" ]; then
        cp "$INSTALL_DIR/database.db" "$backup_dir/database.db.$timestamp"
        log_success "Database backed up"
    fi
}

# Update repository
update_repository() {
    log_info "Updating repository..."
    
    cd "$INSTALL_DIR"
    
    # Check if it's a git repository
    if [ ! -d ".git" ]; then
        log_error "Not a git repository. Cannot update."
        exit 1
    fi
    
    # Fetch latest changes
    git fetch origin
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_warning "Uncommitted changes detected"
        read -p "Continue anyway? (y/N): " continue_update
        if [[ ! "$continue_update" =~ ^[Yy]$ ]]; then
            log_info "Update cancelled"
            exit 0
        fi
    fi
    
    # Pull latest changes
    git pull origin main || {
        log_error "Failed to pull latest changes"
        exit 1
    }
    
    log_success "Repository updated"
}

# Update dependencies
update_dependencies() {
    log_info "Updating dependencies..."
    
    cd "$INSTALL_DIR"
    
    # Update dashboard dependencies
    log_info "Updating dashboard dependencies..."
    npm install --production
    
    # Update bot dependencies
    if [ -d "aether-discord-bot" ]; then
        log_info "Updating bot dependencies..."
        cd aether-discord-bot
        npm install --production
        cd ..
    fi
    
    log_success "Dependencies updated"
}

# Restart services
restart_services() {
    log_info "Restarting services..."
    
    # Restart dashboard
    if pm2 list | grep -q "aether-dashboard"; then
        log_info "Restarting dashboard..."
        pm2 restart aether-dashboard
        log_success "Dashboard restarted"
    else
        log_warning "Dashboard service not found in PM2"
    fi
    
    # Restart Discord bot
    if pm2 list | grep -q "aether-discord-bot"; then
        log_info "Restarting Discord bot..."
        pm2 restart aether-discord-bot
        log_success "Discord bot restarted"
    else
        log_warning "Discord bot service not found in PM2"
    fi
    
    # Save PM2 configuration
    pm2 save
}

# Verify update
verify_update() {
    log_info "Verifying update..."
    
    # Check PM2 status
    if pm2 list | grep -q "aether-dashboard.*online"; then
        log_success "Dashboard service is running"
    else
        log_error "Dashboard service is not running"
    fi
    
    if pm2 list | grep -q "aether-discord-bot.*online"; then
        log_success "Discord bot service is running"
    else
        log_warning "Discord bot service is not running"
    fi
}

# Main update flow
main() {
    echo ""
    log_info "Starting Aether Dashboard update..."
    echo ""
    
    check_installation
    backup_config
    update_repository
    update_dependencies
    restart_services
    verify_update
    
    echo ""
    log_success "Update completed successfully!"
    echo ""
    log_info "Backups saved to: $INSTALL_DIR/backups/"
    log_info "Update logs saved to: $LOG_FILE"
    echo ""
}

# Run main function
main

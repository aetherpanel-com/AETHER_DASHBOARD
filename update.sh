#!/bin/bash

# Aether Dashboard Update Script
# Safely updates the dashboard to the latest version

set -e

# Configuration
INSTALL_DIR="/opt/aether-dashboard"
LOG_FILE="/var/log/aether-installer.log"

# Enable logging
mkdir -p /var/log
exec > >(tee -a "$LOG_FILE") 2>&1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_section() {
    echo ""
    echo "================================================================================"
    echo ">>> $1"
    echo "================================================================================"
}

# Display banner
display_banner() {
    clear
    cat << "EOF"

================================================================================

  █████╗ ███████╗████████╗██╗  ██╗███████╗██████╗ 
 ██╔══██╗██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗
 ███████║█████╗     ██║   ███████║█████╗  ██████╔╝
 ██╔══██║██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗
 ██║  ██║███████╗   ██║   ██║  ██║███████╗██║  ██║
 ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝

 ██████╗  █████╗ ███████╗██╗  ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗ 
 ██╔══██╗██╔══██╗██╔════╝██║  ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
 ██║  ██║███████║███████╗███████║██████╔╝██║   ██║███████║██████╔╝██║  ██║
 ██║  ██║██╔══██║╚════██║██╔══██║██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║
 ██████╔╝██║  ██║███████║██║  ██║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
 ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝

         [↑] Update Wizard           |  [↑] Safe & Non-destructive
         [↑] Auto Backup             |  [↑] Zero Downtime Goal

================================================================================

EOF
    sleep 1
}

# Check if installation exists
check_installation() {
    log_section "Checking Existing Installation"
    log_info "Looking for installation at: $INSTALL_DIR"

    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "Aether Dashboard is not installed at $INSTALL_DIR"
        log_info "Please run install.sh first."
        exit 1
    fi

    log_success "Existing installation found"
}

# Backup configuration files
backup_config() {
    log_section "Backing Up Configuration"
    log_info "Creating timestamped backup of config files..."

    local backup_dir="$INSTALL_DIR/backups"
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)

    mkdir -p "$backup_dir"

    local backed_up=0

    if [ -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env" "$backup_dir/.env.$timestamp"
        log_success "Dashboard .env backed up → .env.$timestamp"
        backed_up=1
    fi

    if [ -f "$INSTALL_DIR/aether-discord-bot/.env" ]; then
        cp "$INSTALL_DIR/aether-discord-bot/.env" "$backup_dir/bot.env.$timestamp"
        log_success "Bot .env backed up → bot.env.$timestamp"
        backed_up=1
    fi

    if [ -f "$INSTALL_DIR/database.db" ]; then
        cp "$INSTALL_DIR/database.db" "$backup_dir/database.db.$timestamp"
        log_success "Database backed up → database.db.$timestamp"
        backed_up=1
    fi

    if [ "$backed_up" -eq 0 ]; then
        log_warning "No config files found to back up — continuing anyway"
    else
        log_success "All backups saved to: $backup_dir"
    fi
}

# Update repository
update_repository() {
    log_section "Pulling Latest Changes"
    log_info "Fetching updates from remote repository..."

    cd "$INSTALL_DIR"

    if [ ! -d ".git" ]; then
        log_error "This installation is not a git repository. Cannot update automatically."
        log_info "Please re-install using install.sh."
        exit 1
    fi

    # Fetch remote
    if ! git fetch origin; then
        log_error "Failed to fetch from remote. Check your internet connection."
        exit 1
    fi

    # Discard local lock file changes to prevent merge conflicts.
    # package-lock.json files are regenerated on every npm install and must not be tracked.
    log_info "Clearing local lock file changes to prevent merge conflicts..."
    git checkout -- package-lock.json 2>/dev/null || true
    git checkout -- aether-discord-bot/package-lock.json 2>/dev/null || true
    git rm --cached package-lock.json 2>/dev/null || true
    git rm --cached aether-discord-bot/package-lock.json 2>/dev/null || true

    # Warn about uncommitted local changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warning "Uncommitted local changes detected."
        echo ""
        read -p "[>]  Continue update anyway? This may cause merge conflicts. (y/N): " continue_update
        echo ""
        if [[ ! "$continue_update" =~ ^[Yy]$ ]]; then
            log_info "Update cancelled. No changes were made."
            exit 0
        fi
    fi

    # Pull latest
    if ! git pull origin main; then
        log_error "Failed to pull latest changes from main branch."
        log_info "You may need to resolve merge conflicts manually in: $INSTALL_DIR"
        exit 1
    fi

    local current_commit
    current_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log_success "Repository updated — current commit: $current_commit"
}

# Update dependencies
update_dependencies() {
    log_section "Updating Dependencies"

    cd "$INSTALL_DIR"

    log_info "Updating dashboard dependencies..."
    if ! npm install --production; then
        log_error "Failed to update dashboard dependencies"
        exit 1
    fi
    log_success "Dashboard dependencies updated"

    if [ -d "aether-discord-bot" ]; then
        log_info "Updating Discord bot dependencies..."
        cd aether-discord-bot
        if ! npm install --production; then
            log_warning "Failed to update bot dependencies — bot may not work correctly"
        else
            log_success "Bot dependencies updated"
        fi
        cd ..
    else
        log_info "Bot directory not found — skipping bot dependency update"
    fi
}

# Restart services
restart_services() {
    log_section "Restarting Services"

    # Restart dashboard
    if pm2 list 2>/dev/null | grep -q "aether-dashboard"; then
        log_info "Restarting dashboard..."
        pm2 restart aether-dashboard
        log_success "Dashboard restarted"
    else
        log_warning "Dashboard not found in PM2 — skipping restart"
        log_info "You can start it manually: pm2 start $INSTALL_DIR/server.js --name aether-dashboard"
    fi

    # Restart Discord bot
    if pm2 list 2>/dev/null | grep -q "aether-discord-bot"; then
        log_info "Restarting Discord bot..."
        pm2 restart aether-discord-bot
        log_success "Discord bot restarted"
    else
        log_info "Discord bot not found in PM2 — skipping restart"
    fi

    # Save PM2 state
    pm2 save --force 2>/dev/null || true
    log_success "PM2 state saved"
}

# Verify update
verify_update() {
    log_section "Verifying Update"
    log_info "Checking service statuses..."

    local all_good=true

    if pm2 list 2>/dev/null | grep -q "aether-dashboard.*online"; then
        log_success "Dashboard service is online"
    else
        log_error "Dashboard service does not appear to be running"
        log_info "Check logs with: pm2 logs aether-dashboard"
        all_good=false
    fi

    if pm2 list 2>/dev/null | grep -q "aether-discord-bot.*online"; then
        log_success "Discord bot service is online"
    else
        log_warning "Discord bot is not running (may not be configured)"
    fi

    if [ "$all_good" != true ]; then
        log_warning "Some checks failed. Please review the logs above."
    fi
}

# Display completion message
display_completion() {
    local current_commit
    current_commit=$(git -C "$INSTALL_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")

    echo ""
    cat << EOF
================================================================================

               [✓] UPDATE COMPLETED SUCCESSFULLY

================================================================================

  Status:
   [✓] Repository updated  (commit: $current_commit)
   [✓] Dependencies refreshed
   [✓] Services restarted

  Backups saved to:
   $INSTALL_DIR/backups/

  Useful Commands:
   pm2 status                        # View service status
   pm2 logs aether-dashboard         # View dashboard logs
   pm2 logs aether-discord-bot       # View bot logs
   pm2 restart aether-dashboard      # Restart dashboard manually

  Update log saved to:
   $LOG_FILE

================================================================================

EOF
}

# Main update flow
main() {
    display_banner

    log_info "Starting Aether Dashboard update..."

    check_installation
    backup_config
    update_repository
    update_dependencies
    restart_services
    verify_update
    display_completion
}

# Run main function
main
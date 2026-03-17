#!/bin/bash

# Aether Dashboard Uninstall Script
# Completely removes the dashboard installation

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

         [!] Uninstall Wizard        |  [!] This action is irreversible
         [!] All data will be lost   |  [!] Backups recommended

================================================================================

EOF
    sleep 1
}

# Check root privileges
check_root() {
    log_section "Checking Root Privileges"
    log_info "Verifying root access..."
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run this uninstaller as root."
        exit 1
    fi
    log_success "Root privileges confirmed"
}

# Confirm uninstallation
confirm_uninstall() {
    log_section "Uninstallation Confirmation"
    echo ""
    echo -e "${RED}  ╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}  ║  ⚠  WARNING: This will permanently delete all data!  ⚠      ║${NC}"
    echo -e "${RED}  ╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "The following will be permanently removed:"
    echo "  [✗] Installation directory : $INSTALL_DIR"
    echo "  [✗] PM2 processes          : aether-dashboard, aether-discord-bot"
    echo "  [✗] Nginx configuration    : /etc/nginx/sites-available/aether-dashboard"
    echo ""
    read -p "  Are you sure you want to continue? (type 'yes' to confirm): " confirm
    echo ""

    if [ "$confirm" != "yes" ]; then
        log_info "Uninstallation cancelled. No changes were made."
        exit 0
    fi
}

# Stop services
stop_services() {
    log_section "Stopping Services"
    log_info "Stopping all running services..."

    # Stop dashboard
    if pm2 list 2>/dev/null | grep -q "aether-dashboard"; then
        log_info "Stopping dashboard..."
        pm2 stop aether-dashboard 2>/dev/null || true
        pm2 delete aether-dashboard 2>/dev/null || true
        log_success "Dashboard stopped and removed from PM2"
    else
        log_info "Dashboard service not found — skipping"
    fi

    # Stop Discord bot
    if pm2 list 2>/dev/null | grep -q "aether-discord-bot"; then
        log_info "Stopping Discord bot..."
        pm2 stop aether-discord-bot 2>/dev/null || true
        pm2 delete aether-discord-bot 2>/dev/null || true
        log_success "Discord bot stopped and removed from PM2"
    else
        log_info "Discord bot service not found — skipping"
    fi

    # Save PM2 state
    pm2 save --force 2>/dev/null || true
    log_success "PM2 state saved"
}

# Remove Nginx configuration
remove_nginx_config() {
    log_section "Removing Nginx Configuration"

    local nginx_config="/etc/nginx/sites-available/aether-dashboard"
    local nginx_enabled="/etc/nginx/sites-enabled/aether-dashboard"

    if [ -f "$nginx_config" ]; then
        rm -f "$nginx_config"
        log_success "Nginx config file removed"
    else
        log_info "Nginx config file not found — skipping"
    fi

    if [ -L "$nginx_enabled" ]; then
        rm -f "$nginx_enabled"
        log_success "Nginx symlink removed"
    else
        log_info "Nginx symlink not found — skipping"
    fi

    if systemctl is-active --quiet nginx; then
        systemctl reload nginx
        log_success "Nginx reloaded successfully"
    else
        log_warning "Nginx is not running — skipping reload"
    fi
}

# Optional: Remove SSL certificate
remove_ssl() {
    log_section "SSL Certificate Removal"
    read -p "[>]  Remove SSL certificate? (y/N): " remove_ssl_cert
    echo ""

    if [[ "$remove_ssl_cert" =~ ^[Yy]$ ]]; then
        log_info "Attempting to detect domain from Nginx config..."

        local domain=""
        if [ -f "/etc/nginx/sites-available/aether-dashboard" ]; then
            domain=$(grep -oP "server_name \K[^;]+" /etc/nginx/sites-available/aether-dashboard 2>/dev/null | head -n1 | awk '{print $1}')
        fi

        if [ -n "$domain" ]; then
            log_info "Removing SSL certificate for: $domain"
            certbot delete --cert-name "$domain" --non-interactive 2>/dev/null && \
                log_success "SSL certificate removed" || {
                log_warning "Could not automatically remove SSL certificate"
                log_info "Remove manually with: certbot delete --cert-name $domain"
            }
        else
            log_warning "Could not detect domain name. SSL certificate not removed."
            log_info "List certificates with: certbot certificates"
            log_info "Remove manually with:   certbot delete --cert-name <your-domain>"
        fi
    else
        log_info "Skipping SSL certificate removal"
    fi
}

# Remove installation directory
remove_installation() {
    log_section "Removing Installation Directory"
    log_info "Checking installation directory: $INSTALL_DIR"

    if [ -d "$INSTALL_DIR" ]; then
        if [ -d "$INSTALL_DIR/backups" ]; then
            echo ""
            read -p "[>]  Backup files found. Keep them? (Y/n): " keep_backups
            echo ""
            if [[ "$keep_backups" =~ ^[Nn]$ ]]; then
                log_warning "Deleting installation directory including backups..."
                rm -rf "$INSTALL_DIR"
            else
                local backup_dest="/tmp/aether-dashboard-backups-$(date +%Y%m%d-%H%M%S)"
                mv "$INSTALL_DIR/backups" "$backup_dest"
                log_success "Backups preserved at: $backup_dest"
                rm -rf "$INSTALL_DIR"
            fi
        else
            rm -rf "$INSTALL_DIR"
        fi
        log_success "Installation directory removed"
    else
        log_warning "Installation directory not found — nothing to remove"
    fi
}

# Display completion message
display_completion() {
    echo ""
    cat << EOF
================================================================================

               [✓] UNINSTALLATION COMPLETED SUCCESSFULLY

================================================================================

  Removed:
   [✓] PM2 processes (dashboard & bot)
   [✓] Nginx configuration
   [✓] Installation directory: $INSTALL_DIR

  Uninstall log saved to:
   $LOG_FILE

  To reinstall at any time, run:
   bash <(curl -s https://raw.githubusercontent.com/aetherpanel-com/AETHER_DASHBOARD/main/install.sh)

================================================================================

EOF
}

# Main uninstall flow
main() {
    display_banner

    log_info "Starting Aether Dashboard uninstallation..."

    check_root
    confirm_uninstall
    stop_services
    remove_nginx_config
    remove_ssl
    remove_installation
    display_completion
}

# Run main function
main
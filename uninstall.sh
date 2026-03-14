#!/bin/bash

# Aether Dashboard Uninstall Script
# Completely removes the dashboard installation

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

# Check root privileges
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run this uninstaller as root."
        exit 1
    fi
}

# Confirm uninstallation
confirm_uninstall() {
    echo ""
    log_warning "This will completely remove Aether Dashboard and all its data!"
    echo ""
    log_info "The following will be removed:"
    echo "  - Installation directory: $INSTALL_DIR"
    echo "  - PM2 processes: aether-dashboard, aether-discord-bot"
    echo "  - Nginx configuration: /etc/nginx/sites-available/aether-dashboard"
    echo ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Uninstallation cancelled"
        exit 0
    fi
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    
    # Stop dashboard
    if pm2 list | grep -q "aether-dashboard"; then
        log_info "Stopping dashboard..."
        pm2 stop aether-dashboard || true
        pm2 delete aether-dashboard || true
        log_success "Dashboard stopped"
    else
        log_info "Dashboard service not found"
    fi
    
    # Stop Discord bot
    if pm2 list | grep -q "aether-discord-bot"; then
        log_info "Stopping Discord bot..."
        pm2 stop aether-discord-bot || true
        pm2 delete aether-discord-bot || true
        log_success "Discord bot stopped"
    else
        log_info "Discord bot service not found"
    fi
    
    # Save PM2 configuration
    pm2 save || true
}

# Remove installation directory
remove_installation() {
    log_info "Removing installation directory..."
    
    if [ -d "$INSTALL_DIR" ]; then
        # Ask about backups
        if [ -d "$INSTALL_DIR/backups" ]; then
            read -p "Keep backup files? (Y/n): " keep_backups
            if [[ "$keep_backups" =~ ^[Nn]$ ]]; then
                rm -rf "$INSTALL_DIR"
            else
                # Move backups to /tmp before deletion
                local backup_dest="/tmp/aether-dashboard-backups-$(date +%Y%m%d-%H%M%S)"
                mv "$INSTALL_DIR/backups" "$backup_dest"
                log_info "Backups moved to: $backup_dest"
                rm -rf "$INSTALL_DIR"
            fi
        else
            rm -rf "$INSTALL_DIR"
        fi
        
        log_success "Installation directory removed"
    else
        log_warning "Installation directory not found"
    fi
}

# Remove Nginx configuration
remove_nginx_config() {
    log_info "Removing Nginx configuration..."
    
    local nginx_config="/etc/nginx/sites-available/aether-dashboard"
    local nginx_enabled="/etc/nginx/sites-enabled/aether-dashboard"
    
    if [ -f "$nginx_config" ]; then
        rm -f "$nginx_config"
        log_success "Nginx configuration file removed"
    fi
    
    if [ -L "$nginx_enabled" ]; then
        rm -f "$nginx_enabled"
        log_success "Nginx enabled link removed"
    fi
    
    # Reload Nginx
    if systemctl is-active --quiet nginx; then
        systemctl reload nginx
        log_success "Nginx reloaded"
    fi
}

# Optional: Remove SSL certificate
remove_ssl() {
    read -p "Remove SSL certificate? (y/N): " remove_ssl_cert
    
    if [[ "$remove_ssl_cert" =~ ^[Yy]$ ]]; then
        log_info "Removing SSL certificate..."
        
        # Get domain from Nginx config if it still exists
        local domain=""
        if [ -f "/etc/nginx/sites-available/aether-dashboard" ]; then
            domain=$(grep -oP "server_name \K[^;]+" /etc/nginx/sites-available/aether-dashboard | head -n1 | awk '{print $1}')
        fi
        
        if [ -n "$domain" ]; then
            certbot delete --cert-name "$domain" --non-interactive || {
                log_warning "Could not automatically remove SSL certificate"
                log_info "You may need to remove it manually using: certbot delete --cert-name $domain"
            }
        else
            log_warning "Could not detect domain name. SSL certificate not removed."
            log_info "You can remove it manually using: certbot certificates"
        fi
    fi
}

# Display completion message
display_completion() {
    echo ""
    echo "=================================="
    echo "Aether Dashboard Uninstalled"
    echo "=================================="
    echo ""
    log_success "Uninstallation completed successfully!"
    echo ""
    log_info "The following were removed:"
    echo "  ✓ Installation directory"
    echo "  ✓ PM2 processes"
    echo "  ✓ Nginx configuration"
    echo ""
    log_info "Uninstall logs saved to: $LOG_FILE"
    echo ""
}

# Main uninstall flow
main() {
    echo ""
    log_info "Starting Aether Dashboard uninstallation..."
    echo ""
    
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

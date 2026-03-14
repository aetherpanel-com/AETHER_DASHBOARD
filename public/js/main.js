// Aether Dashboard - Main JavaScript File
// Common functions used across all pages

// Show notification message
function showNotification(message, type = 'info') {
    // Convert message to string if it's an object
    let messageText = message;
    if (typeof message === 'object' && message !== null) {
        // Try to extract a meaningful message from the object
        messageText = message.detail || 
                      message.message || 
                      message.error ||
                      (message.toString && message.toString() !== '[object Object]' ? message.toString() : 'An error occurred');
    } else if (message === null || message === undefined) {
        messageText = 'An error occurred';
    }
    
    // Ensure it's a string
    messageText = String(messageText);
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = messageText;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#667eea'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// API fetch wrapper with credentials
async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, {
            credentials: 'same-origin', // Always send cookies with requests
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            console.warn('[apiFetch] Session expired. Redirecting to login.');
            window.location.href = '/auth/login';
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('[apiFetch] Error:', error);
        return null;
    }
}

// Make API request
async function apiRequest(url, options = {}) {
    try {
        const response = await apiFetch(url, options);
        if (!response) {
            throw new Error('Network or authentication error');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'An error occurred');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Reusable Sidebar Dropdown System - Generic handler for all dropdowns
function setupDropdownToggle() {
    // Generic click handler for all sidebar dropdown toggles
    function handleDropdownClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Find the closest sidebar dropdown container
        const dropdown = this.closest('.sidebar-dropdown');
        if (dropdown) {
            // Toggle the 'open' class on the parent dropdown
            // This will trigger CSS to rotate the arrow via .sidebar-dropdown.open .dropdown-arrow
            dropdown.classList.toggle('open');
        }
    }
    
    // Remove existing listeners and add new ones to prevent duplicates
    document.querySelectorAll('.sidebar-dropdown-toggle').forEach(toggle => {
        // Remove old listener by cloning
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        
        // Add new click handler
        newToggle.addEventListener('click', handleDropdownClick);
    });
    
    // Initialize sidebar state on page load
    initializeSidebarState();
}

// Initialize sidebar dropdown state based on current page
function initializeSidebarState() {
    const currentPath = window.location.pathname;
    
    // Only initialize admin dropdowns if on admin pages
    if (currentPath.startsWith('/admin')) {
        // Always expand Admin Panel dropdown on admin pages
        const adminPanelDropdown = document.querySelector('.sidebar-dropdown.admin-only');
        if (adminPanelDropdown) {
            adminPanelDropdown.classList.add('open');
        }
        
        // Auto-expand nested dropdowns based on current page
        if (currentPath.startsWith('/admin/settings')) {
            // Find Admin Settings nested dropdown
            document.querySelectorAll('.sidebar-dropdown.nested').forEach(dropdown => {
                const toggle = dropdown.querySelector('.sidebar-dropdown-toggle');
                if (toggle && toggle.textContent.includes('Admin Settings')) {
                    dropdown.classList.add('open');
                }
            });
        } else if (currentPath.startsWith('/admin/integrations')) {
            // Find Integrations nested dropdown
            document.querySelectorAll('.sidebar-dropdown.nested').forEach(dropdown => {
                const toggle = dropdown.querySelector('.sidebar-dropdown-toggle');
                if (toggle && toggle.textContent.includes('Integrations')) {
                    dropdown.classList.add('open');
                }
            });
        }
    }
}

// Mobile menu toggle functionality
function initMobileMenu() {
    // Setup dropdown toggle for Admin Settings
    setupDropdownToggle();
    
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (menuBtn && sidebar && overlay) {
        // Toggle sidebar
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            // Prevent body scroll when menu is open
            if (sidebar.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });
        
        // Close sidebar when overlay is clicked
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        // Close sidebar when clicking a nav item (on mobile)
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Close sidebar on window resize if it becomes desktop size
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
}


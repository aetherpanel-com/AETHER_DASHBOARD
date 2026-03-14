// Dashboard JavaScript
// Handles dashboard functionality and data loading

// Load user data from session
async function loadUserData() {
    try {
        // Get user info from server
        const response = await fetch('/dashboard/api/user');
        if (response.ok) {
            const data = await response.json();
            if (data.user) {
                // Update username if element exists (only on dashboard page)
                const usernameElement = document.getElementById('username');
                if (usernameElement) {
                    usernameElement.textContent = data.user.username;
                }
                
                // Update coin amount - this should exist on all pages
                const coinAmountElement = document.getElementById('coinAmount');
                if (coinAmountElement) {
                    coinAmountElement.textContent = formatNumber(data.user.coins || 0);
                }
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await fetch('/servers/api/list');
        if (response.ok) {
            const data = await response.json();
            const serverCount = data.servers ? data.servers.length : 0;
            document.getElementById('serverCount').textContent = serverCount;
        }
        
        // Load coin balance
        const userResponse = await fetch('/dashboard/api/user');
        if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.user) {
                document.getElementById('totalCoins').textContent = formatNumber(userData.user.coins || 0);
            }
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Check if user is admin and show admin panel link
function checkAdminAccess() {
    fetch('/dashboard/api/user')
        .then(res => res.json())
        .then(data => {
            if (data.user && data.user.is_admin) {
                // Show all admin-only items
                document.querySelectorAll('.admin-only').forEach(item => {
                    // Use 'block' for dropdown containers, 'flex' for nav items
                    if (item.classList.contains('sidebar-dropdown') || item.classList.contains('nav-dropdown')) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'flex';
                    }
                });
                
                // Re-initialize sidebar state after admin access is confirmed
                if (typeof initializeSidebarState === 'function') {
                    initializeSidebarState();
                }
            } else {
                // Hide admin items if not admin
                document.querySelectorAll('.admin-only').forEach(item => {
                    item.style.display = 'none';
                });
            }
        })
        .catch(err => {
            console.error('Error checking admin access:', err);
            // On error, hide admin items for security
            document.querySelectorAll('.admin-only').forEach(item => {
                item.style.display = 'none';
            });
        });
}

// Load and apply branding settings (logo, favicon, name, shape)
async function loadBrandingSettings() {
    try {
        const response = await fetch('/admin/api/branding');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.settings) {
                // Update dashboard name in sidebar
                const sidebarTitle = document.querySelector('.sidebar-header h2');
                if (sidebarTitle && data.settings.dashboard_name) {
                    sidebarTitle.textContent = data.settings.dashboard_name;
                }
                
                // Update page title
                if (data.settings.dashboard_name) {
                    const pageTitle = document.querySelector('title');
                    if (pageTitle) {
                        const currentPage = pageTitle.textContent.split(' - ')[1] || '';
                        pageTitle.textContent = currentPage ? `${currentPage} - ${data.settings.dashboard_name}` : data.settings.dashboard_name;
                    }
                }
                
                // Update logo
                if (data.settings.logo_path) {
                    const logos = document.querySelectorAll('.dashboard-logo, .login-logo, .signup-logo');
                    logos.forEach(logo => {
                        logo.src = data.settings.logo_path;
                    });
                }
                
                // Apply logo shape
                if (data.settings.logo_shape) {
                    applyLogoShapeToAll(data.settings.logo_shape);
                } else {
                    // Default to square if no shape is set
                    applyLogoShapeToAll('square');
                }
                
                // Update favicon
                if (data.settings.favicon_path) {
                    const faviconLink = document.querySelector('link[rel="icon"]');
                    if (faviconLink) {
                        faviconLink.href = data.settings.favicon_path;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading branding settings:', error);
        // On error, apply default square shape
        applyLogoShapeToAll('square');
    }
}

// Apply logo shape to all logos on the page
function applyLogoShapeToAll(shape) {
    const logos = document.querySelectorAll('.dashboard-logo, .login-logo, .signup-logo');
    const shapes = ['square', 'circle', 'rounded', 'triangle', 'hexagon', 'diamond'];
    
    logos.forEach(logo => {
        // Remove all shape classes
        shapes.forEach(s => {
            logo.classList.remove(`logo-${s}`);
        });
        // Add selected shape class
        logo.classList.add(`logo-${shape}`);
    });
}


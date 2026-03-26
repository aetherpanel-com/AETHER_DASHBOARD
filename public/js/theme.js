/**
 * Theme Manager for Aether Dashboard
 * Handles dynamic theme application across all pages
 * Version 1.3
 */

// Default theme fallback (Midnight Dark — matches server DEFAULT_PRESET_ID)
const DEFAULT_THEME = {
    sidebar_bg_type: 'gradient',
    sidebar_color_1: '#18181b',
    sidebar_color_2: '#27272a',
    sidebar_color_3: '#3f3f46',
    sidebar_gradient_direction: '180deg',
    sidebar_text_color: '#fafafa',
    sidebar_active_bg: 'rgba(255, 255, 255, 0.15)',
    sidebar_hover_bg: 'rgba(255, 255, 255, 0.1)',
    main_bg_type: 'gradient',
    main_color_1: '#09090b',
    main_color_2: '#18181b',
    main_color_3: '#27272a',
    main_gradient_direction: '135deg',
    card_bg_color: 'rgba(39, 39, 42, 0.6)',
    card_border_color: 'rgba(113, 113, 122, 0.3)',
    card_text_color: '#fafafa',
    accent_primary: '#a1a1aa',
    accent_secondary: '#d4d4d8',
    accent_tertiary: '#e4e4e7',
    accent_success: '#22c55e',
    accent_warning: '#f59e0b',
    accent_danger: '#ef4444',
    input_bg_color: 'rgba(39, 39, 42, 0.4)',
    input_border_color: 'rgba(113, 113, 122, 0.3)',
    input_text_color: '#fafafa',
    input_placeholder_color: '#a1a1aa',
    header_bg_color: 'rgba(24, 24, 27, 0.9)',
    header_text_color: '#fafafa'
};

function setGlassPresetFlag(activePreset) {
    const id = activePreset != null ? String(activePreset) : '';
    const isGlass = id.startsWith('glass_');
    if (isGlass) {
        document.documentElement.dataset.aetherGlass = '1';
    } else {
        delete document.documentElement.dataset.aetherGlass;
    }
}

// Apply theme to CSS variables
function applyTheme(theme) {
    const root = document.documentElement;
    const t = theme || DEFAULT_THEME;
    
    // Sidebar
    if (t.sidebar_bg_type === 'gradient') {
        root.style.setProperty('--sidebar-bg', `linear-gradient(${t.sidebar_gradient_direction}, ${t.sidebar_color_1} 0%, ${t.sidebar_color_2} 50%, ${t.sidebar_color_3} 100%)`);
    } else {
        root.style.setProperty('--sidebar-bg', t.sidebar_color_1);
    }
    root.style.setProperty('--sidebar-text', t.sidebar_text_color);
    root.style.setProperty('--sidebar-active-bg', t.sidebar_active_bg);
    root.style.setProperty('--sidebar-hover-bg', t.sidebar_hover_bg);
    
    // Main frame
    if (t.main_bg_type === 'gradient') {
        root.style.setProperty('--main-bg', `linear-gradient(${t.main_gradient_direction}, ${t.main_color_1} 0%, ${t.main_color_2} 50%, ${t.main_color_3} 100%)`);
    } else {
        root.style.setProperty('--main-bg', t.main_color_1);
    }
    
    // Cards
    root.style.setProperty('--card-bg', t.card_bg_color);
    root.style.setProperty('--card-border', t.card_border_color);
    root.style.setProperty('--card-text', t.card_text_color);
    
    // Accents
    root.style.setProperty('--accent-primary', t.accent_primary);
    root.style.setProperty('--accent-secondary', t.accent_secondary);
    root.style.setProperty('--accent-tertiary', t.accent_tertiary);
    root.style.setProperty('--accent-success', t.accent_success);
    root.style.setProperty('--accent-warning', t.accent_warning);
    root.style.setProperty('--accent-danger', t.accent_danger);
    
    // Generate accent variations for gradients and shadows
    root.style.setProperty('--accent-primary-rgb', hexToRgb(t.accent_primary));
    root.style.setProperty('--accent-secondary-rgb', hexToRgb(t.accent_secondary));
    
    // Inputs
    root.style.setProperty('--input-bg', t.input_bg_color);
    root.style.setProperty('--input-border', t.input_border_color);
    root.style.setProperty('--input-text', t.input_text_color);
    root.style.setProperty('--input-placeholder', t.input_placeholder_color);
    
    // Header
    root.style.setProperty('--header-bg', t.header_bg_color);
    root.style.setProperty('--header-text', t.header_text_color);
    
    // Store theme in session storage for quick access
    try {
        sessionStorage.setItem('aether_theme', JSON.stringify(t));
    } catch (e) {
        // Ignore storage errors
    }
}

// Convert hex color to RGB values for use in rgba()
function hexToRgb(hex) {
    if (!hex) return '161, 161, 170';
    
    // Handle rgba format
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
        const match = hex.match(/\d+/g);
        if (match && match.length >= 3) {
            return `${match[0]}, ${match[1]}, ${match[2]}`;
        }
        return '161, 161, 170';
    }
    
    // Handle hex format
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
    return '161, 161, 170';
}

// Fetch and apply theme from server
async function loadAndApplyTheme() {
    // First, try to apply cached theme immediately for instant rendering
    try {
        const cachedTheme = sessionStorage.getItem('aether_theme');
        if (cachedTheme) {
            applyTheme(JSON.parse(cachedTheme));
        }
    } catch (e) {
        // Ignore cache errors
    }
    
    // Then fetch fresh theme from server
    try {
        const response = await fetch('/admin/api/theme');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.theme) {
                setGlassPresetFlag(data.active_preset);
                applyTheme(data.theme);
            }
        }
    } catch (error) {
        console.error('Error loading theme:', error);
        // Apply default theme on error
        setGlassPresetFlag('');
        applyTheme(DEFAULT_THEME);
    }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', loadAndApplyTheme);

// Export functions for use in admin settings
if (typeof window !== 'undefined') {
    window.AetherTheme = {
        apply: applyTheme,
        load: loadAndApplyTheme,
        setGlassPresetFlag,
        DEFAULT: DEFAULT_THEME,
        hexToRgb: hexToRgb
    };
}

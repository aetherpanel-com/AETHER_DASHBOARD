const fs = require('fs');

const DEFAULT_BRANDING = {
    name: 'Aether Dashboard',
    logoPath: '/assets/defaults/aether-dashboard-logo.png',
    faviconPath: '/assets/defaults/aether-dashboard-favicon.ico',
    logoShape: 'square'
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttribute(str) {
    return escapeHtml(str).replace(/`/g, '&#096;');
}

function getBrandingSync(db, callback) {
    db.get('SELECT * FROM dashboard_settings LIMIT 1', (err, row) => {
        if (err) {
            console.error('Error loading branding settings:', err);
        }

        callback({
            name: (row && row.dashboard_name) || DEFAULT_BRANDING.name,
            logoPath: (row && row.logo_path) || DEFAULT_BRANDING.logoPath,
            faviconPath: (row && row.favicon_path) || DEFAULT_BRANDING.faviconPath,
            logoShape: (row && row.logo_shape) || DEFAULT_BRANDING.logoShape
        });
    });
}

function applyBrandingToHtml(html, branding) {
    const safeName = escapeHtml(branding.name || DEFAULT_BRANDING.name);
    const safeLogoPath = escapeAttribute(branding.logoPath || DEFAULT_BRANDING.logoPath);
    const safeFaviconPath = escapeAttribute(branding.faviconPath || DEFAULT_BRANDING.faviconPath);
    const safeShape = escapeAttribute(branding.logoShape || DEFAULT_BRANDING.logoShape);

    let output = html
        .replace(/href="\/assets\/defaults\/aether-dashboard-favicon\.ico"/g, `href="${safeFaviconPath}"`)
        .replace(/src="\/assets\/defaults\/aether-dashboard-logo\.png"/g, `src="${safeLogoPath}"`)
        .replace(/(<title>[^<]*?)Aether Dashboard(<\/title>)/g, `$1${safeName}$2`)
        .replace(/(<h2[^>]*>)Aether Dashboard(<\/h2>)/g, `$1${safeName}$2`)
        .replace(/(<h1[^>]*>)Aether Dashboard(<\/h1>)/g, `$1${safeName}$2`);

    output = output.replace(
        /class="([^"]*\b(?:dashboard-logo|login-logo|signup-logo)\b[^"]*)"/g,
        (_, classNames) => {
            const classes = classNames.split(/\s+/).filter(Boolean);
            const filtered = classes.filter(c => !/^logo-/.test(c));
            filtered.push(`logo-${safeShape}`);
            return `class="${filtered.join(' ')}"`;
        }
    );

    return output;
}

function sendBrandedView(res, db, viewPath) {
    getBrandingSync(db, (branding) => {
        try {
            const html = fs.readFileSync(viewPath, 'utf8');
            res.send(applyBrandingToHtml(html, branding));
        } catch (error) {
            console.error('Error reading view file:', error);
            res.status(500).send('Internal Server Error');
        }
    });
}

module.exports = {
    getBrandingSync,
    applyBrandingToHtml,
    sendBrandedView,
    escapeHtml
};

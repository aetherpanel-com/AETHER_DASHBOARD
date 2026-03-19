(() => {
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDateTime(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString();
    }

    function formatCountdown(ms) {
        const clamped = Math.max(0, ms);
        const totalMinutes = Math.floor(clamped / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    }

    async function loadMaintenanceBanner() {
        let data;
        try {
            const resp = await fetch('/maintenance/api/status', { credentials: 'same-origin' });
            if (!resp.ok) return;
            data = await resp.json();
        } catch (e) {
            return;
        }

        if (!data || (!data.active && !data.upcoming)) return;

        const existing = document.getElementById('maintenance-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'maintenance-banner';

        banner.style.position = 'sticky';
        banner.style.top = '0';
        banner.style.zIndex = '9998';
        banner.style.width = '100%';
        banner.style.padding = '10px 16px';
        banner.style.borderBottom = '1px solid rgba(255,255,255,0.15)';
        banner.style.backdropFilter = 'blur(10px)';
        banner.style.fontWeight = '700';
        banner.style.color = '#fff';

        if (data.active) {
            banner.style.background = 'rgba(239, 68, 68, 0.95)'; // red
            banner.innerHTML = `🔴 ${escapeHtml(data.title || 'Scheduled Maintenance')} — ${escapeHtml(data.message || '')} — until ${escapeHtml(formatDateTime(data.ends_at))}`;
        } else {
            banner.style.background = 'rgba(245, 158, 11, 0.95)'; // amber

            let countdown = '';
            if (data.starts_at) {
                const starts = new Date(data.starts_at).getTime();
                countdown = Number.isFinite(starts) ? formatCountdown(starts - Date.now()) : '';
            }

            banner.innerHTML = `🔧 ${escapeHtml(data.title || 'Scheduled Maintenance')} — ${escapeHtml(data.message || '')} — starts in ${escapeHtml(countdown || '...')} (${escapeHtml(formatDateTime(data.starts_at))})`;
        }

        // Insert as first child of body.
        if (document.body.firstChild) {
            document.body.insertBefore(banner, document.body.firstChild);
        } else {
            document.body.appendChild(banner);
        }
    }

    document.addEventListener('DOMContentLoaded', loadMaintenanceBanner);
})();


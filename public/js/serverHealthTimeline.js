(() => {
    const SLOTS = 24;

    const STATUS_STYLE = {
        online: { height: 20, color: '#22c55e' }, // green
        starting: { height: 14, color: '#38bdf8' }, // blue
        offline: { height: 6, color: '#374151' }, // slate
        installing: { height: 12, color: '#f59e0b' } // amber
    };

    const EMPTY_BAR = { height: 2, color: 'rgba(148, 163, 184, 0.22)' };

    function toTimeLabel(recordedAt) {
        if (!recordedAt) return '';
        const d = new Date(recordedAt);
        if (Number.isNaN(d.getTime())) return String(recordedAt);
        return d.toLocaleString();
    }

    function statusLabel(status) {
        const s = String(status || '').toLowerCase();
        if (!s) return 'No data';
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    async function renderHealthTimeline(serverId, containerEl) {
        if (!containerEl || !serverId) return;

        containerEl.innerHTML = '';

        const barsWrap = document.createElement('div');
        barsWrap.style.display = 'flex';
        barsWrap.style.alignItems = 'flex-end';
        barsWrap.style.gap = '1px';
        barsWrap.style.height = '20px';

        const uptimeEl = document.createElement('div');
        uptimeEl.style.fontSize = '11px';
        uptimeEl.style.color = '#94a3b8';
        uptimeEl.style.whiteSpace = 'nowrap';
        uptimeEl.style.marginLeft = '6px';
        uptimeEl.textContent = 'Uptime: …';

        containerEl.appendChild(barsWrap);
        containerEl.appendChild(uptimeEl);

        let timeline = [];
        try {
            const resp = await fetch(`/servers/api/health-timeline/${serverId}`, {
                credentials: 'same-origin'
            });

            const data = await resp.json();
            if (data && data.success && Array.isArray(data.timeline)) {
                timeline = data.timeline;
            }
        } catch (e) {
            // Best-effort only; render empty bars.
        }

        const records = timeline.slice(-SLOTS);
        const padCount = Math.max(0, SLOTS - records.length);

        const padded = [
            ...Array.from({ length: padCount }, () => null),
            ...records
        ];

        let onlineCount = 0;
        for (const r of records) {
            if (String(r?.status || '').toLowerCase() === 'online') onlineCount++;
        }

        const total = records.length;
        const uptimePct = total > 0 ? (onlineCount / total) * 100 : 0;

        barsWrap.innerHTML = '';

        for (const rec of padded) {
            const status = rec?.status;
            const recordedAt = rec?.recorded_at;

            const key = String(status || '').toLowerCase();
            const meta = rec ? (STATUS_STYLE[key] || STATUS_STYLE.offline) : EMPTY_BAR;

            const bar = document.createElement('div');
            bar.style.width = '6px';
            bar.style.height = `${meta.height}px`;
            bar.style.background = meta.color;
            bar.style.borderRadius = '3px 3px 0 0';

            if (rec) {
                const label = statusLabel(status);
                const t = toTimeLabel(recordedAt);
                bar.title = `${label} • ${t || 'unknown time'}`;
            } else {
                bar.title = 'No data';
                bar.style.opacity = '0.6';
            }

            barsWrap.appendChild(bar);
        }

        uptimeEl.textContent = `Uptime: ${uptimePct.toFixed(0)}%`;
    }

    function initHealthTimelines() {
        const containers = document.querySelectorAll('[data-health-server-id]');
        containers.forEach((el) => {
            const serverId = el.getAttribute('data-health-server-id');
            renderHealthTimeline(serverId, el);
        });
    }

    window.renderHealthTimeline = renderHealthTimeline;
    window.initHealthTimelines = initHealthTimelines;

    document.addEventListener('DOMContentLoaded', () => {
        if (window.initHealthTimelines) window.initHealthTimelines();
    });
})();


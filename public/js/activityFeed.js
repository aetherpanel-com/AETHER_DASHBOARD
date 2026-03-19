(() => {
    const TYPE_STYLES = {
        coin_earned: { icon: '🪙', color: '#22c55e' }, // green
        coin_spent: { icon: '💸', color: '#f59e0b' }, // amber
        server_created: { icon: '🚀', color: '#a855f7' }, // purple
        server_started: { icon: '▶️', color: '#22c55e' }, // green
        server_stopped: { icon: '⏹️', color: '#94a3b8' }, // grey
        resource_purchased: { icon: '📦', color: '#8b5cf6' }, // violet
        daily_reward: { icon: '🎁', color: '#ec4899' }, // pink
        referral_bonus: { icon: '👥', color: '#14b8a6' }, // teal
        linkvertise_completed: { icon: '🔗', color: '#facc15' } // yellow
    };

    function escape(text) {
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(text);
        const s = String(text ?? '');
        return s
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function parseTimestamp(ts) {
        if (!ts) return null;
        if (typeof ts === 'string') {
            // SQLite CURRENT_TIMESTAMP format: YYYY-MM-DD HH:MM:SS (UTC)
            const d = new Date(ts.replace(' ', 'T') + 'Z');
            if (!Number.isNaN(d.getTime())) return d;
        }
        const d = new Date(ts);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function timeAgo(date) {
        if (!date) return '';
        const diffMs = Date.now() - date.getTime();
        const sec = Math.max(0, Math.floor(diffMs / 1000));
        if (sec < 10) return 'just now';
        if (sec < 60) return `${sec}s ago`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const day = Math.floor(hr / 24);
        return `${day}d ago`;
    }

    function renderSpinner(container) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap: 10px; padding: 16px; color: #cbd5e1;">
                <div style="
                    width: 18px; height: 18px;
                    border-radius: 999px;
                    border: 2px solid rgba(148, 163, 184, 0.25);
                    border-top-color: rgba(168, 85, 247, 0.9);
                    animation: activitySpin 0.8s linear infinite;
                "></div>
                <div style="font-weight: 700;">Loading activity…</div>
            </div>
        `;

        if (!document.getElementById('activityFeedSpinStyle')) {
            const style = document.createElement('style');
            style.id = 'activityFeedSpinStyle';
            style.textContent = `@keyframes activitySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    }

    function renderEmpty(container) {
        container.innerHTML = `
            <div style="padding: 16px; color: #cbd5e1; display:flex; align-items:center; gap: 10px;">
                <div style="font-size: 18px;">📭</div>
                <div style="font-weight: 700;">No activity yet</div>
            </div>
        `;
    }

    function renderFeed(container, feed) {
        const rows = (feed || []).map(evt => {
            const style = TYPE_STYLES[evt.type] || { icon: '📝', color: '#64748b' };
            const when = timeAgo(parseTimestamp(evt.created_at));

            return `
                <div style="
                    display:flex;
                    align-items:flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px 10px;
                    border-top: 1px solid rgba(124, 58, 237, 0.15);
                ">
                    <div style="display:flex; align-items:flex-start; gap: 12px; min-width: 0;">
                        <div style="
                            width: 34px; height: 34px;
                            border-radius: 10px;
                            background: rgba(30, 30, 50, 0.45);
                            border: 1px solid rgba(124, 58, 237, 0.18);
                            display:flex; align-items:center; justify-content:center;
                            box-shadow: 0 8px 18px rgba(0,0,0,0.15);
                            color: ${style.color};
                            flex: 0 0 auto;
                        " title="${escape(evt.type)}">${style.icon}</div>
                        <div style="min-width: 0;">
                            <div style="color:#f8fafc; font-weight: 800; font-size: 13px; line-height: 1.25; word-break: break-word;">
                                ${escape(evt.message || '')}
                            </div>
                            <div style="color:#94a3b8; font-size: 12px; margin-top: 4px;">
                                ${escape(evt.type || '')}
                            </div>
                        </div>
                    </div>
                    <div style="color:#94a3b8; font-size: 12px; font-weight: 700; white-space: nowrap; margin-top: 2px;">
                        ${escape(when)}
                    </div>
                </div>
            `;
        });

        container.innerHTML = rows.join('') || '';
    }

    async function loadActivityFeed() {
        const container = document.getElementById('activity-feed-container');
        if (!container) return;

        renderSpinner(container);

        try {
            const res = await fetch('/activity/api/feed?limit=20', { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to load activity feed');
            const data = await res.json();
            const feed = data.feed || [];

            if (!Array.isArray(feed) || feed.length === 0) {
                renderEmpty(container);
                return;
            }

            renderFeed(container, feed);
        } catch (e) {
            container.innerHTML = `
                <div style="padding: 16px; color: #fca5a5; font-weight: 800;">
                    Failed to load activity feed.
                </div>
            `;
        }
    }

    window.loadActivityFeed = loadActivityFeed;

    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('activity-feed-container');
        if (!container) return;
        loadActivityFeed();
    });
})();


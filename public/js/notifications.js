(() => {
    const ICON_BY_TYPE = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '🔴'
    };

    const BG_BY_TYPE = {
        info: '#7c3aed',
        success: '#16a34a',
        warning: '#f59e0b',
        error: '#ef4444'
    };

    const TYPE_NORMALIZE = (t) => {
        const s = String(t || 'info').toLowerCase();
        return ['info', 'success', 'warning', 'error'].includes(s) ? s : 'info';
    };

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
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

    function parseTimestamp(ts) {
        if (!ts) return null;
        if (typeof ts === 'string') {
            // SQLite CURRENT_TIMESTAMP often comes like: YYYY-MM-DD HH:MM:SS
            const d = new Date(ts.replace(' ', 'T') + 'Z');
            if (!Number.isNaN(d.getTime())) return d;
        }
        const d = new Date(ts);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function getDrawer() {
        return document.getElementById('notificationDrawer');
    }

    function getListArea() {
        return document.getElementById('notificationListArea');
    }

    function getBadge() {
        return document.getElementById('notificationUnreadBadge');
    }

    function setBadge(count) {
        const badge = getBadge();
        if (!badge) return;
        const n = Number(count) || 0;
        badge.textContent = String(n);
        badge.style.opacity = n > 0 ? '1' : '0';
    }

    function renderSpinner(listArea) {
        if (!listArea) return;
        listArea.innerHTML = `
            <div style="padding: 16px; color: #cbd5e1; display:flex; align-items:center; gap:10px;">
                <div style="
                    width: 18px; height: 18px; border-radius: 999px;
                    border: 2px solid rgba(148, 163, 184, 0.25);
                    border-top-color: rgba(124, 58, 237, 0.9);
                    animation: notifSpin 0.8s linear infinite;"></div>
                <div style="font-weight: 700;">Loading…</div>
            </div>
        `;
    }

    function renderEmpty(listArea) {
        if (!listArea) return;
        listArea.innerHTML = `
            <div style="padding: 16px; color: #cbd5e1; display:flex; align-items:center; gap:10px;">
                <div style="font-size:18px;">📭</div>
                <div style="font-weight: 800;">No notifications</div>
            </div>
        `;
    }

    function renderNotifications(listArea, notifications) {
        if (!listArea) return;
        const rows = (notifications || []).map((n) => {
            const type = TYPE_NORMALIZE(n.type);
            const icon = ICON_BY_TYPE[type] || ICON_BY_TYPE.info;
            const created = parseTimestamp(n.created_at);
            const when = timeAgo(created);
            const isUnread = !n.is_read;

            const bg = isUnread ? 'rgba(124, 58, 237, 0.12)' : 'transparent';
            const border = isUnread ? 'rgba(124, 58, 237, 0.35)' : 'rgba(124, 58, 237, 0.14)';
            const dot = isUnread ? `<span style="width:8px;height:8px;border-radius:999px;background:#7c3aed;display:inline-block;margin-right:10px;"></span>` : `<span style="width:8px;height:8px;border-radius:999px;background:transparent;display:inline-block;margin-right:10px;"></span>`;

            return `
                <div
                    style="
                        display:flex; align-items:flex-start; justify-content: space-between;
                        gap: 12px;
                        padding: 12px 10px;
                        border-radius: 12px;
                        border: 1px solid ${border};
                        background: ${bg};
                        margin-bottom: 10px;
                    "
                >
                    <div style="display:flex; align-items:flex-start; gap: 12px; min-width: 0;">
                        <div style="
                            width: 34px; height: 34px; border-radius: 10px;
                            display:flex; align-items:center; justify-content:center;
                            background: rgba(30,30,50,0.4);
                            border: 1px solid rgba(124,58,237,0.2);
                            color: ${BG_BY_TYPE[type]};
                            flex: 0 0 auto;
                        ">
                            ${icon}
                        </div>
                        <div style="min-width:0;">
                            <div style="color:#f8fafc; font-weight: 900; font-size: 13px; line-height:1.25; word-break: break-word;">
                                ${dot}<span>${escapeHtml(n.title || '')}</span>
                            </div>
                            <div style="color:#cbd5e1; font-size: 13px; margin-top: 4px; line-height:1.4; word-break: break-word;">
                                ${escapeHtml(n.message || '')}
                            </div>
                        </div>
                    </div>
                    <div style="color:#94a3b8; font-size: 12px; font-weight: 700; white-space: nowrap; margin-top: 2px;">
                        ${escapeHtml(when)}
                    </div>
                </div>
            `;
        });

        listArea.innerHTML = rows.join('') || '';
    }

    async function fetchAndRenderList() {
        const drawer = getDrawer();
        const listArea = getListArea();
        if (!drawer || !listArea) return;

        renderSpinner(listArea);

        const res = await fetch('/notifications/api/list', { credentials: 'same-origin' });
        if (!res.ok) {
            listArea.innerHTML = `
                <div style="padding: 16px; color:#fca5a5; font-weight: 800;">
                    Failed to load notifications.
                </div>
            `;
            return;
        }

        const data = await res.json();
        setBadge(data.unread_count || 0);

        const notifications = data.notifications || [];
        if (notifications.length === 0) {
            renderEmpty(listArea);
            return;
        }
        renderNotifications(listArea, notifications);
    }

    async function markAllReadAndRefresh() {
        const res = await fetch('/notifications/api/read-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });
        if (!res.ok) return;

        setBadge(0);
        await fetchAndRenderList();
    }

    let discordInviteCache = null; // { configured, url, expires }

    function ensureDiscordInviteModal() {
        if (document.getElementById('discordInviteModalRoot')) return;
        const root = document.createElement('div');
        root.id = 'discordInviteModalRoot';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'discordInviteModalTitle');
        root.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10001;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(2, 6, 23, 0.72);
            backdrop-filter: blur(10px);
        `;
        root.innerHTML = `
            <div id="discordInviteModalPanel" style="
                width: 100%;
                max-width: 400px;
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid rgba(124, 58, 237, 0.45);
                border-radius: 16px;
                box-shadow: 0 22px 60px rgba(0,0,0,0.5);
                padding: 22px 22px 18px;
            ">
                <div id="discordInviteModalTitle" style="color:#f8fafc; font-weight: 900; font-size: 17px; margin-bottom: 10px;">
                    💬 Discord
                </div>
                <div style="color:#cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 18px;">
                    Discord Link Not Configured by Admin
                </div>
                <button type="button" id="discordInviteModalClose" class="btn btn-secondary" style="width:100%; padding: 10px 14px; border-radius: 10px; font-weight: 800;">
                    OK
                </button>
            </div>
        `;
        document.body.appendChild(root);

        const close = () => {
            root.style.display = 'none';
        };
        root.querySelector('#discordInviteModalClose').addEventListener('click', close);
        root.addEventListener('click', (e) => {
            if (e.target === root) close();
        });
    }

    function showDiscordInviteNotConfigured() {
        ensureDiscordInviteModal();
        const root = document.getElementById('discordInviteModalRoot');
        if (root) root.style.display = 'flex';
    }

    async function fetchPublicDiscordInvite() {
        const now = Date.now();
        if (discordInviteCache && discordInviteCache.expires > now) {
            return discordInviteCache;
        }
        try {
            const res = await fetch('/api/discord/public-invite', { credentials: 'same-origin' });
            const data = res.ok ? await res.json() : { success: false, configured: false, url: null };
            const configured = !!(data && data.configured && data.url);
            const url = configured ? String(data.url) : null;
            discordInviteCache = { configured, url, expires: now + 60_000 };
            return discordInviteCache;
        } catch {
            discordInviteCache = { configured: false, url: null, expires: now + 15_000 };
            return discordInviteCache;
        }
    }

    function ensureBellAndDrawer() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        // Bell button (inject once)
        if (!document.getElementById('notificationBellBtn')) {
            const coinBalance = headerRight.querySelector('.coin-balance');

            const bellBtn = document.createElement('button');
            bellBtn.id = 'notificationBellBtn';
            bellBtn.type = 'button';
            bellBtn.className = 'btn btn-secondary';
            bellBtn.style.cssText = `
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 12px;
                border-radius: 10px;
            `;
            bellBtn.innerHTML = `<span style="font-size: 18px;">🔔</span>`;

            const badge = document.createElement('span');
            badge.id = 'notificationUnreadBadge';
            badge.textContent = '0';
            badge.style.cssText = `
                position: absolute;
                top: 4px;
                right: 4px;
                min-width: 18px;
                height: 18px;
                padding: 0 6px;
                background: #7c3aed;
                color: white;
                font-size: 12px;
                font-weight: 900;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
            `;
            bellBtn.appendChild(badge);

            if (coinBalance) {
                headerRight.insertBefore(bellBtn, coinBalance);
            } else {
                headerRight.appendChild(bellBtn);
            }
        }

        if (!document.getElementById('discordInviteHeaderBtn')) {
            const coinBalance = headerRight.querySelector('.coin-balance');
            const discordBtn = document.createElement('button');
            discordBtn.id = 'discordInviteHeaderBtn';
            discordBtn.type = 'button';
            discordBtn.className = 'btn btn-secondary';
            discordBtn.setAttribute('aria-label', 'Join Discord server');
            discordBtn.title = 'Discord';
            discordBtn.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 10px 12px;
                border-radius: 10px;
            `;
            discordBtn.innerHTML = `<span style="font-size: 20px; line-height: 1;" aria-hidden="true">💬</span>`;
            discordBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const { configured, url } = await fetchPublicDiscordInvite();
                if (configured && url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                } else {
                    showDiscordInviteNotConfigured();
                }
            });
            if (coinBalance) {
                headerRight.insertBefore(discordBtn, coinBalance);
            } else {
                headerRight.appendChild(discordBtn);
            }
        }

        if (!document.getElementById('notificationDrawer')) {
            const drawer = document.createElement('div');
            drawer.id = 'notificationDrawer';
            drawer.style.cssText = `
                position: fixed;
                top: 90px;
                right: 20px;
                width: 340px;
                max-width: calc(100vw - 40px);
                background: rgba(15, 23, 42, 0.98);
                backdrop-filter: blur(14px);
                border: 1px solid rgba(124, 58, 237, 0.35);
                border-radius: 16px;
                box-shadow: 0 22px 60px rgba(0,0,0,0.45);
                z-index: 9999;
                display: none;
            `;
            drawer.innerHTML = `
                <div style="padding: 14px 16px; border-bottom: 1px solid rgba(124,58,237,0.18); display:flex; align-items:center; justify-content: space-between; gap: 12px;">
                    <div style="color:#f8fafc; font-weight: 900;">Notifications</div>
                    <button id="markAllReadBtn" type="button" class="btn btn-secondary" style="padding: 8px 12px; border-radius: 10px;">
                        Mark all read
                    </button>
                </div>
                <div id="notificationListArea" style="padding: 14px 14px; max-height: 460px; overflow-y:auto;"></div>
            `;
            document.body.appendChild(drawer);

            // Attach close-on-outside-click
            document.addEventListener('mousedown', (e) => {
                const btn = document.getElementById('notificationBellBtn');
                const discordBtn = document.getElementById('discordInviteHeaderBtn');
                const modalRoot = document.getElementById('discordInviteModalRoot');
                const d = getDrawer();
                if (!btn || !d) return;
                if (d.style.display === 'none') return;

                if (discordBtn && discordBtn.contains(e.target)) return;
                if (modalRoot && modalRoot.style.display !== 'none' && modalRoot.contains(e.target)) return;

                const clickedInside = d.contains(e.target) || (btn && btn.contains(e.target));
                if (!clickedInside) d.style.display = 'none';
            });

            const markAll = document.getElementById('markAllReadBtn');
            if (markAll) {
                markAll.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await markAllReadAndRefresh();
                });
            }
        }

        const btn = document.getElementById('notificationBellBtn');
        if (btn && !btn.dataset.notifUiBound) {
            btn.dataset.notifUiBound = '1';
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const drawer = getDrawer();
                if (!drawer) return;

                const willOpen = drawer.style.display === 'none';
                drawer.style.display = willOpen ? 'block' : 'none';

                if (willOpen) {
                    await fetchAndRenderList();
                }
            });
        }

        // Hide drawer initially
        const drawer = getDrawer();
        if (drawer) drawer.style.display = 'none';
    }

    function ensureToastContainer() {
        if (document.getElementById('toastContainer')) return;

        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 18px;
            right: 18px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);

        const style = document.createElement('style');
        style.id = 'toastAnimStyle';
        style.textContent = `
            @keyframes toastIn {
                from { transform: translateX(20px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes toastOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(20px); opacity: 0; }
            }
            @keyframes notifSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    window.showToast = function showToast(type, title, message) {
        ensureToastContainer();
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastType = TYPE_NORMALIZE(type);
        const bg = BG_BY_TYPE[toastType] || BG_BY_TYPE.info;
        const icon = ICON_BY_TYPE[toastType] || ICON_BY_TYPE.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
            pointer-events: auto;
            background: ${bg};
            color: white;
            border-radius: 14px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            padding: 12px 14px;
            min-width: 280px;
            max-width: 340px;
            border: 1px solid rgba(255,255,255,0.12);
            animation: toastIn 0.25s ease both;
            cursor: pointer;
        `;

        toast.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap: 10px;">
                <div style="font-size: 18px; line-height:1.1; margin-top: 2px;">${icon}</div>
                <div style="min-width: 0;">
                    <div style="font-weight: 900; font-size: 13px; line-height:1.2;">${escapeHtml(title || '')}</div>
                    <div style="margin-top: 4px; font-size: 13px; line-height:1.35; color: rgba(255,255,255,0.95); word-break: break-word;">
                        ${escapeHtml(message || '')}
                    </div>
                </div>
            </div>
        `;

        const dismiss = () => {
            toast.style.animation = 'toastOut 0.2s ease both';
            setTimeout(() => toast.remove(), 200);
        };

        toast.addEventListener('click', dismiss);
        container.appendChild(toast);

        setTimeout(dismiss, 5000);
    };

    async function initUnreadBadge() {
        try {
            const res = await fetch('/notifications/api/list', { credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();
            setBadge(data.unread_count || 0);
        } catch {
            // ignore
        }
    }

    function attachSocketListener(socket) {
        if (!socket || typeof socket.on !== 'function') return;

        socket.on('notification', (data) => {
            if (!data) return;
            const type = TYPE_NORMALIZE(data.type);
            const title = data.title || 'Notification';
            const message = data.message || '';

            // Toast + badge increment
            window.showToast(type, title, message);

            const badge = getBadge();
            const curr = badge ? Number(badge.textContent || '0') : 0;
            const next = (Number.isFinite(curr) ? curr : 0) + 1;
            setBadge(next);

            // If drawer is open, refresh it.
            const drawer = getDrawer();
            if (drawer && drawer.style.display !== 'none') {
                fetchAndRenderList().catch(() => {});
            }
        });
    }

    function initSocketListeners() {
        // If a socket exists globally, use it.
        if (window.socket && typeof window.socket.on === 'function') {
            attachSocketListener(window.socket);
            return;
        }

        document.addEventListener('socketReady', (e) => {
            const socket = e?.detail;
            attachSocketListener(socket);
        });
    }

    // Self-initialise
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            ensureToastContainer();
            ensureBellAndDrawer();
            await initUnreadBadge();
            initSocketListeners();
        } catch {
            // If injection fails, silently ignore.
        }
    });
})();


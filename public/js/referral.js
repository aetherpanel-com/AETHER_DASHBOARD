document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('referral-card-container');
    if (!container) return;

    async function fetchInfo() {
        const res = await fetch('/referral/api/info', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch referral info');
        return res.json();
    }

    function buildFullLink(referralLink) {
        try {
            return `${window.location.origin}${referralLink}`;
        } catch {
            return referralLink;
        }
    }

    function render(info) {
        if (!info || !info.enabled) {
            container.style.display = 'none';
            return;
        }

        const fullLink = buildFullLink(info.referral_link || '');

        container.style.display = '';
        container.innerHTML = `
            <div class="card">
                <div class="card-header">👥 Referral</div>
                <p style="color: #cbd5e1; margin-bottom: 14px;">
                    Invite friends to join and earn coins.
                </p>

                <div style="display:flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 14px;">
                    <input
                        id="referralLinkInput"
                        type="text"
                        readonly
                        value="${escapeHtml(fullLink)}"
                        style="flex: 1; min-width: 240px; padding: 10px 12px; background: var(--input-bg); border: 1px solid var(--input-border); border-radius: 10px; color: var(--input-text);"
                    />
                    <button id="copyReferralBtn" type="button" class="btn btn-primary" style="white-space: nowrap;">
                        📋 Copy
                    </button>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
                    <div style="padding: 14px; background: rgba(30, 30, 50, 0.4); border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 12px;">
                        <div style="color:#94a3b8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">Total referrals</div>
                        <div style="color:#f8fafc; font-size: 24px; font-weight: 900; margin-top: 6px;">${escapeHtml(info.total_referrals || 0)}</div>
                    </div>
                    <div style="padding: 14px; background: rgba(30, 30, 50, 0.4); border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 12px;">
                        <div style="color:#94a3b8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">Coins earned</div>
                        <div style="color:#f8fafc; font-size: 24px; font-weight: 900; margin-top: 6px;">${escapeHtml(info.coins_earned || 0)}</div>
                    </div>
                </div>

                <div style="color:#cbd5e1; font-size: 13px;">
                    You earn <strong style="color:#a855f7;">${escapeHtml(info.referrer_reward || 0)}</strong> coins per referral,
                    they earn <strong style="color:#a855f7;">${escapeHtml(info.referee_reward || 0)}</strong> coins on signup.
                </div>
            </div>
        `;

        const copyBtn = document.getElementById('copyReferralBtn');
        const input = document.getElementById('referralLinkInput');

        if (copyBtn && input) {
            copyBtn.addEventListener('click', async () => {
                try {
                    const text = input.value || '';
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                    } else {
                        input.select();
                        document.execCommand('copy');
                        input.setSelectionRange(0, 0);
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('Referral link copied to clipboard!', 'success');
                    }
                } catch (e) {
                    if (typeof showNotification === 'function') {
                        showNotification('Failed to copy referral link', 'error');
                    }
                }
            });
        }
    }

    try {
        const info = await fetchInfo();
        render(info);
    } catch (e) {
        container.style.display = 'none';
    }
});


// Daily login reward widget (dashboard)

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('daily-reward-container');
    if (!container) return;

    // Fetch status and render widget.
    async function fetchStatus() {
        const res = await fetch('/daily-reward/api/status', { credentials: 'same-origin' });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text || `Daily reward status failed (${res.status})`);
        }
        return res.json();
    }

    function getRewardsByDay(rewards) {
        const byDay = Array(8).fill(0); // index 1..7
        (rewards || []).forEach(r => {
            const d = parseInt(r.day_number);
            const c = parseInt(r.coins);
            if (d >= 1 && d <= 7 && !Number.isNaN(c)) byDay[d] = c;
        });
        return byDay;
    }

    function renderWidget(status) {
        const enabled = !!status.enabled;
        if (!enabled) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = '';

        const claimed = !!status.claimed;
        const streak = parseInt(status.streak) || 0;
        const nextDay = parseInt(status.next_day) || 1;
        const rewardsByDay = getRewardsByDay(status.rewards);

        // If already claimed, highlight the streak day we just completed.
        const highlightDay = claimed ? (streak > 0 ? Math.min(streak, 7) : nextDay) : nextDay;
        const maxDay = 7;

        const boxes = [];
        for (let day = 1; day <= maxDay; day++) {
            const coinAmount = rewardsByDay[day] || 0;
            const isCompleted = claimed ? day <= streak : day < streak;
            const isHighlight = !isCompleted && day === highlightDay && !Number.isNaN(highlightDay);
            const isFuture = day > highlightDay;

            let bg = 'rgba(30, 30, 50, 0.45)';
            let border = 'rgba(124, 58, 237, 0.25)';
            let color = '#cbd5e1';
            let extraStyle = '';
            let topRight = '';

            if (day === 7) {
                color = '#f59e0b';
            }

            if (isCompleted) {
                bg = 'rgba(16, 185, 129, 0.15)';
                border = 'rgba(16, 185, 129, 0.35)';
                color = '#22c55e';
                topRight = '✓';
            } else if (isHighlight) {
                bg = 'rgba(124, 58, 237, 0.22)';
                border = 'rgba(168, 85, 247, 0.55)';
                color = '#a855f7';
                extraStyle = 'transform: scale(1.08); box-shadow: 0 10px 25px rgba(124,58,237,0.25);';
            }

            if (!isCompleted && isFuture) {
                // Future days dimmed (when not reached yet).
                bg = 'rgba(30, 30, 50, 0.25)';
                border = 'rgba(124, 58, 237, 0.15)';
                extraStyle = 'opacity: 0.55;';
            }

            const starOrLabel = day === 7 ? '⭐' : '';

            boxes.push(`
                <div style="
                    position: relative;
                    flex: 1;
                    min-width: 90px;
                    padding: 14px 12px;
                    background: ${bg};
                    border: 1px solid ${border};
                    border-radius: 12px;
                    text-align: center;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                    ${extraStyle}
                ">
                    <div style="font-size: 13px; color: ${color}; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>Day ${day}</span>
                        <span>${starOrLabel}</span>
                    </div>
                    <div style="margin-top: 8px; font-size: 18px; color: #f8fafc; font-weight: 800;">
                        ${escapeHtml(coinAmount)}
                        <span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">coins</span>
                    </div>
                    ${topRight ? `<div style="position:absolute; top:8px; right:10px; color:#22c55e; font-weight:900;">${topRight}</div>` : ''}
                </div>
            `);
        }

        const claimButtonHtml = claimed
            ? `<div style="margin-top: 14px; padding: 12px 14px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; color: #cbd5e1;">
                    <strong style="color: #22c55e;">Come back tomorrow!</strong>
                    <div style="margin-top: 4px; font-size: 13px;">Current streak: <strong style="color: #a855f7;">${streak}</strong> day(s)</div>
               </div>`
            : `<button
                    id="dailyRewardClaimBtn"
                    class="btn btn-primary"
                    style="margin-top: 14px; width: 100%; padding: 12px 16px; font-size: 14px;"
                >
                    Claim Day ${nextDay} Reward (+${escapeHtml(rewardsByDay[nextDay] || 0)} coins)
                </button>
                <div style="margin-top: 10px; color: #94a3b8; font-size: 13px; text-align: center;">
                    Daily streak resets if you miss a day.
                </div>`;

        container.innerHTML = `
            <div style="
                margin-bottom: 18px;
                padding: 18px;
                background: rgba(30, 30, 50, 0.5);
                border: 1px solid rgba(124, 58, 237, 0.3);
                border-radius: 16px;
            ">
                <div style="display:flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 14px; color:#94a3b8; font-weight: 700;">🎁 Daily Login Reward</div>
                        <div style="margin-top: 6px; font-size: 16px; color:#f8fafc; font-weight: 900;">
                            Streak: <span style="color:#a855f7;">${streak}</span> / 7 days
                        </div>
                    </div>
                    <div style="padding: 10px 14px; background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.25); border-radius: 12px;">
                        <div style="font-size: 13px; color:#cbd5e1;">Next reward day</div>
                        <div style="font-size: 18px; color:#a855f7; font-weight: 900; margin-top: 4px;">
                            Day ${nextDay}
                        </div>
                    </div>
                </div>

                <div style="margin-top: 14px; display:flex; gap: 12px; align-items: stretch; flex-wrap: wrap;">
                    ${boxes.join('')}
                </div>

                ${claimButtonHtml}
            </div>
        `;

        if (!claimed) {
            const btn = document.getElementById('dailyRewardClaimBtn');
            if (btn) {
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    btn.textContent = 'Claiming...';
                    try {
                        const claimRes = await fetch('/daily-reward/api/claim', {
                            method: 'POST',
                            credentials: 'same-origin'
                        });
                        const claimData = await claimRes.json().catch(() => ({}));

                        if (claimRes.ok && claimData.success) {
                            showNotification(claimData.message || 'Daily reward claimed!', 'success');
                            const coinEl = document.getElementById('coinAmount');
                            if (coinEl) coinEl.textContent = formatNumber(claimData.new_balance || 0);
                            // Re-render from fresh status.
                            const nextStatus = await fetchStatus();
                            renderWidget(nextStatus);
                        } else {
                            showNotification(claimData.message || 'Failed to claim daily reward', 'error');
                            btn.disabled = false;
                            btn.textContent = `Claim Day ${nextDay} Reward (+${escapeHtml(rewardsByDay[nextDay] || 0)} coins)`;
                        }
                    } catch (e) {
                        console.error('Daily claim error:', e);
                        showNotification('Error claiming daily reward', 'error');
                        btn.disabled = false;
                        btn.textContent = `Claim Day ${nextDay} Reward (+${escapeHtml(rewardsByDay[nextDay] || 0)} coins)`;
                    }
                });
            }
        }
    }

    try {
        const status = await fetchStatus();
        renderWidget(status);
    } catch (error) {
        console.error('Daily reward init error:', error);
        // Don't hard-fail the entire dashboard. Just keep it hidden.
        container.style.display = 'none';
    }
});


(() => {
    function fadeOutAndRemove(el, durationMs = 220) {
        el.style.transition = `opacity ${durationMs}ms ease, transform ${durationMs}ms ease`;
        el.style.opacity = '0';
        el.style.transform = 'translateY(-6px)';
        setTimeout(() => {
            el.remove();
        }, durationMs);
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function dismissChecklist() {
        await fetch('/onboarding/api/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({})
        }).catch(() => {});
    }

    async function loadOnboarding() {
        const container = document.getElementById('onboarding-container');
        if (!container) return;

        let data;
        try {
            const resp = await fetch('/onboarding/api/status', {
                credentials: 'same-origin'
            });
            if (!resp.ok) return;
            data = await resp.json();
        } catch (e) {
            // Silent fail: onboarding should never break dashboard.
            return;
        }

        if (!data) return;

        if (data.dismissed) {
            container.style.display = 'none';
            return;
        }

        const steps = Array.isArray(data.steps) ? data.steps : [];
        const doneCount = steps.filter(s => s.done).length;

        const card = document.createElement('div');
        card.id = 'onboarding-card';
        card.style.position = 'relative';
        card.style.padding = '18px 16px';
        card.style.marginBottom = '16px';
        card.style.background = 'rgba(30, 30, 50, 0.55)';
        card.style.border = '1px solid rgba(124, 58, 237, 0.3)';
        card.style.borderRadius = '12px';
        card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
        card.style.overflow = 'hidden';

        const progressPct = Math.round((Math.min(doneCount, 4) / 4) * 100);

        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.textContent = '×';
        dismissBtn.setAttribute('aria-label', 'Dismiss onboarding checklist');
        dismissBtn.style.position = 'absolute';
        dismissBtn.style.top = '10px';
        dismissBtn.style.right = '12px';
        dismissBtn.style.width = '28px';
        dismissBtn.style.height = '28px';
        dismissBtn.style.borderRadius = '10px';
        dismissBtn.style.border = '1px solid rgba(124, 58, 237, 0.3)';
        dismissBtn.style.background = 'rgba(124, 58, 237, 0.1)';
        dismissBtn.style.color = '#cbd5e1';
        dismissBtn.style.cursor = 'pointer';

        dismissBtn.addEventListener('click', async () => {
            dismissBtn.disabled = true;
            await dismissChecklist();
            fadeOutAndRemove(card);
        });

        const title = document.createElement('div');
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '10px';
        title.style.paddingRight = '44px';
        title.style.marginBottom = '10px';

        title.innerHTML = `
            <div style="font-size: 18px; font-weight: 800; color: #f8fafc;">🚀 Getting Started</div>
        `;

        const progressWrap = document.createElement('div');
        progressWrap.style.height = '4px';
        progressWrap.style.width = '100%';
        progressWrap.style.background = 'rgba(148, 163, 184, 0.25)';
        progressWrap.style.borderRadius = '999px';
        progressWrap.style.overflow = 'hidden';
        progressWrap.style.marginBottom = '14px';

        const progressBar = document.createElement('div');
        progressBar.style.height = '100%';
        progressBar.style.width = `${progressPct}%`;
        progressBar.style.background = '#7c3aed';
        progressBar.style.transition = 'width 200ms ease';

        progressWrap.appendChild(progressBar);

        const stepsWrap = document.createElement('div');
        stepsWrap.style.display = 'grid';
        stepsWrap.style.gridTemplateColumns = '1fr';
        stepsWrap.style.gap = '10px';

        steps.slice(0, 4).forEach((s) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.gap = '12px';
            row.style.padding = '12px 12px';
            row.style.borderRadius = '10px';
            row.style.border = '1px solid rgba(124, 58, 237, 0.18)';
            row.style.background = s.done ? 'rgba(34, 197, 94, 0.12)' : 'rgba(124, 58, 237, 0.06)';

            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '10px';

            const label = document.createElement('div');
            label.style.color = '#e5e7eb';
            label.style.fontSize = '14px';
            label.style.fontWeight = '650';
            label.style.textDecoration = s.done ? 'line-through' : 'none';

            label.textContent = s.label;

            const icon = document.createElement('div');
            icon.style.fontSize = '18px';
            icon.textContent = s.icon || '✅';

            left.appendChild(icon);
            left.appendChild(label);

            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.alignItems = 'center';
            right.style.gap = '10px';

            if (s.done) {
                const donePill = document.createElement('div');
                donePill.style.color = '#22c55e';
                donePill.style.fontWeight = '800';
                donePill.style.fontSize = '13px';
                donePill.textContent = 'Done';
                right.appendChild(donePill);
            } else {
                const arrow = document.createElement('a');
                arrow.href = s.link || '#';
                arrow.style.textDecoration = 'none';
                arrow.style.color = '#a78bfa';
                arrow.style.fontWeight = '800';
                arrow.style.padding = '6px 10px';
                arrow.style.borderRadius = '10px';
                arrow.style.border = '1px solid rgba(167, 139, 250, 0.35)';
                arrow.style.background = 'rgba(124, 58, 237, 0.1)';
                arrow.textContent = '→';
                right.appendChild(arrow);
            }

            row.appendChild(left);
            row.appendChild(right);
            stepsWrap.appendChild(row);
        });

        card.appendChild(dismissBtn);
        card.appendChild(title);
        card.appendChild(progressWrap);
        card.appendChild(stepsWrap);

        if (data.allDone) {
            const doneMsg = document.createElement('div');
            doneMsg.style.marginTop = '14px';
            doneMsg.style.padding = '14px 12px';
            doneMsg.style.borderRadius = '12px';
            doneMsg.style.background = 'rgba(34, 197, 94, 0.12)';
            doneMsg.style.border = '1px solid rgba(34, 197, 94, 0.25)';
            doneMsg.style.color = '#e5e7eb';
            doneMsg.style.fontWeight = '750';
            doneMsg.textContent = "🎉 You're all set!";

            const doneActionWrap = document.createElement('div');
            doneActionWrap.style.display = 'flex';
            doneActionWrap.style.justifyContent = 'flex-end';
            doneActionWrap.style.marginTop = '10px';

            const dismissAllBtn = document.createElement('button');
            dismissAllBtn.type = 'button';
            dismissAllBtn.textContent = 'Dismiss checklist';
            dismissAllBtn.className = 'btn btn-secondary';
            dismissAllBtn.style.padding = '10px 14px';
            dismissAllBtn.style.whiteSpace = 'nowrap';

            dismissAllBtn.addEventListener('click', async () => {
                dismissAllBtn.disabled = true;
                await dismissChecklist();
                fadeOutAndRemove(card);
            });

            doneActionWrap.appendChild(dismissAllBtn);
            card.appendChild(doneMsg);
            card.appendChild(doneActionWrap);
        }

        container.innerHTML = '';
        container.appendChild(card);
    }

    document.addEventListener('DOMContentLoaded', loadOnboarding);

    // Expose for debugging/reuse (optional)
    window.loadOnboarding = loadOnboarding;
})();


/**
 * Shared Adsterra embed loader for dashboard slots (ids: adsterraPlacement-<placement_key>).
 */
(function () {
    function adsterraDeviceMatches(target) {
        var t = String(target || 'all').toLowerCase();
        if (t === 'all') return true;
        var mobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches;
        if (t === 'mobile') return mobile;
        if (t === 'desktop') return !mobile;
        return true;
    }

    function injectAdHtml(container, html) {
        var trimmed = String(html || '').trim();
        if (!trimmed || !container) return;
        var tpl = document.createElement('template');
        tpl.innerHTML = trimmed;
        var nodes = Array.from(tpl.content.childNodes);
        nodes.forEach(function (node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
                var s = document.createElement('script');
                for (var i = 0; i < node.attributes.length; i++) {
                    var a = node.attributes[i];
                    s.setAttribute(a.name, a.value);
                }
                s.textContent = node.textContent;
                container.appendChild(s);
            } else {
                container.appendChild(node);
            }
        });
    }

    async function loadAdsterraSlot(placementKey, slot) {
        if (!slot) {
            slot = document.getElementById('adsterraPlacement-' + placementKey);
        }
        if (!slot) return;
        try {
            var url = '/linkvertise/api/adsterra/embed?placement_key=' + encodeURIComponent(placementKey);
            var response = await fetch(url);
            var data = response.ok ? await response.json().catch(function () { return {}; }) : {};
            if (!data.success || !data.enabled || !Array.isArray(data.placements) || data.placements.length === 0) {
                return;
            }
            slot.innerHTML = '';
            slot.setAttribute('role', 'complementary');
            slot.setAttribute('aria-label', 'Advertisement');
            slot.removeAttribute('aria-hidden');
            var shown = 0;
            data.placements.forEach(function (p) {
                if (!adsterraDeviceMatches(p.target_devices)) return;
                var wrap = document.createElement('div');
                wrap.className = 'adsterra-embed-block';
                if (shown > 0) wrap.style.marginTop = '12px';
                slot.appendChild(wrap);
                injectAdHtml(wrap, p.ad_code);
                shown += 1;
            });
            if (shown === 0) {
                slot.innerHTML = '';
                slot.removeAttribute('role');
                slot.removeAttribute('aria-label');
                slot.setAttribute('aria-hidden', 'true');
            }
        } catch (e) {
            console.error('Error loading Adsterra embed:', e);
        }
    }

    function initAdsterraEmbeds() {
        document.querySelectorAll('[id^="adsterraPlacement-"]').forEach(function (el) {
            var key = el.id.replace(/^adsterraPlacement-/, '');
            if (key) loadAdsterraSlot(key, el);
        });
    }

    window.loadAdsterraSlot = loadAdsterraSlot;
    window.initAdsterraEmbeds = initAdsterraEmbeds;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdsterraEmbeds);
    } else {
        initAdsterraEmbeds();
    }
})();

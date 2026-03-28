/**
 * Shared Adsterra embed loader: DOM slots (ids: adsterraPlacement-<placement_key>).
 * Popunder placements (popunder_global, popunder_earn_coins_click) inject into head/body
 * only when loadAdsterraPopunderKey() is called — not on page load (except earn-coins page triggers click placement from completeLink).
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

    function injectPlacementIntoDocument(scriptPlacement, html) {
        var sp = String(scriptPlacement || 'body_end').toLowerCase();
        var target = document.body;
        if (sp === 'head_end' && document.head) {
            target = document.head;
        }
        injectAdHtml(target, html);
    }

    var POPUNDER_KEYS = { popunder_global: 1, popunder_earn_coins_click: 1 };

    /**
     * Load and inject a popunder placement by key (popunder_global or popunder_earn_coins_click).
     * Does not run automatically on page load — call from user gestures (e.g. Earn Coins complete link).
     */
    async function loadAdsterraPopunderKey(placementKey) {
        var key = String(placementKey || '').trim().toLowerCase();
        if (!POPUNDER_KEYS[key]) {
            console.warn('loadAdsterraPopunderKey: unsupported key', placementKey);
            return;
        }
        try {
            var response = await fetch(
                '/linkvertise/api/adsterra/embed?placement_key=' + encodeURIComponent(key)
            );
            var data = response.ok ? await response.json().catch(function () { return {}; }) : {};
            if (!data.success || !data.enabled || !Array.isArray(data.placements) || data.placements.length === 0) {
                return;
            }
            data.placements.forEach(function (p) {
                if (!adsterraDeviceMatches(p.target_devices)) return;
                injectPlacementIntoDocument(p.script_placement, p.ad_code);
            });
        } catch (e) {
            console.error('Error loading Adsterra popunder:', e);
        }
    }

    function loadPopunderGlobal() {
        return loadAdsterraPopunderKey('popunder_global');
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
            if (key && !POPUNDER_KEYS[key]) loadAdsterraSlot(key, el);
        });
    }

    window.loadAdsterraSlot = loadAdsterraSlot;
    window.loadAdsterraPopunderKey = loadAdsterraPopunderKey;
    window.loadPopunderGlobal = loadPopunderGlobal;
    window.initAdsterraEmbeds = initAdsterraEmbeds;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdsterraEmbeds);
    } else {
        initAdsterraEmbeds();
    }
})();

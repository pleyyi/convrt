// made by x01ka — v1.0.5
var UPDATE_URL = 'https://api.github.com/repos/pleyyi/convrt/releases/latest';

function calcConv(raw, letters, timeSec, method, pingMs) {
    if (raw == null) return null;
    if (method === 'x135') return +(raw * 1.35).toFixed(1);
    if (!letters || !timeSec || timeSec <= 0) return null;
    var mult = (method === 'withPing') ? (17 - pingMs * 0.085) : 17;
    return +((letters / timeSec) * mult).toFixed(1);
}

// Push a recalculated WPM to every open monkeytype tab
function reapplyToTabs(method, pingMs, autoApply) {
    if (!autoApply) return;
    chrome.storage.local.get(['lastRaw', 'lastLetters', 'lastTimeSec'], function (s) {
        if (s.lastRaw == null) return;
        var conv = calcConv(s.lastRaw, s.lastLetters, s.lastTimeSec, method, pingMs);
        var display = conv != null ? conv : s.lastRaw;
        // update stored conv
        chrome.storage.local.set({ lastConv: conv }, function () {
            chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function () {});
        });
        // send to all monkeytype tabs
        chrome.tabs.query({ url: 'https://monkeytype.com/*' }, function (tabs) {
            tabs.forEach(function (tab) {
                chrome.tabs.sendMessage(tab.id, { action: 'setWpm', wpm: display }).catch(function () {});
            });
        });
    });
}

chrome.runtime.onMessage.addListener(function (msg, sender, respond) {

    // ── live WPM update (drives the overlay) ──────────────────────────────
    if (msg.action === 'rawChanged') {
        chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function (s) {
            var method    = s.method    || 'withPing';
            var pingMs    = typeof s.pingMs    === 'number'  ? s.pingMs    : 20;
            var autoApply = typeof s.autoApply === 'boolean' ? s.autoApply : true;

            var conv = calcConv(msg.rawWpm, msg.letters, msg.timeSec, method, pingMs);
            var display = conv != null ? conv : msg.rawWpm;

            if (autoApply && sender.tab && sender.tab.id) {
                chrome.tabs.sendMessage(sender.tab.id, { action: 'setWpm', wpm: display })
                    .catch(function () {});
            }

            // persist raw + the values needed to reapply later when settings change
            chrome.storage.local.set({
                lastRaw:     msg.rawWpm,
                lastConv:    conv,
                lastLetters: msg.letters  || null,
                lastTimeSec: msg.timeSec  || null
            }, function () {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function () {});
            });
        });
        return;
    }

    // ── history entry ─────────────────────────────────────────────────────
    if (msg.action === 'historyUpdate') {
        chrome.storage.local.get(['method', 'pingMs', 'testHistory'], function (s) {
            var method = s.method || 'withPing';
            var pingMs = typeof s.pingMs === 'number' ? s.pingMs : 20;
            var hist   = Array.isArray(s.testHistory) ? s.testHistory : [];

            var conv = calcConv(msg.rawWpm, msg.letters, msg.timeSec, method, pingMs);
            if (conv == null) conv = msg.rawWpm;

            hist.push({
                raw:    msg.rawWpm,
                conv:   conv,
                word:   msg.word   || '—',
                failed: !!msg.failed
            });
            if (hist.length > 50) hist = hist.slice(-50);

            chrome.storage.local.set({ testHistory: hist }, function () {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function () {});
            });
        });
        return;
    }

    // ── reapply conversion with current settings (called when ping/method changes) ──
    if (msg.action === 'reapply') {
        chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function (s) {
            var method    = s.method    || 'withPing';
            var pingMs    = typeof s.pingMs    === 'number'  ? s.pingMs    : 20;
            var autoApply = typeof s.autoApply === 'boolean' ? s.autoApply : true;
            reapplyToTabs(method, pingMs, autoApply);
        });
        return;
    }

    // ── update check ──────────────────────────────────────────────────────
    if (msg.action === 'checkUpdate') {
        fetch(UPDATE_URL)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                respond({ tag: data.tag_name || null, url: data.html_url || null });
            })
            .catch(function () { respond({ tag: null, url: null }); });
        return true;
    }
});

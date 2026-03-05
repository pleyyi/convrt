// made by x01ka — v1.0.5
var UPDATE_URL = 'https://api.github.com/repos/pleyyi/convrt/releases/latest';

function calcConv(raw, letters, timeSec, method, pingMs) {
    if (method === 'x135') return raw != null ? +(raw * 1.35).toFixed(1) : null;
    if (!letters || !timeSec || timeSec === 0) return null;
    var mult = method === 'withPing' ? (17 - pingMs * 0.085) : 17;
    return +((letters / timeSec) * mult).toFixed(1);
}

chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
    if (msg.action === 'rawChanged') {
        chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function(s) {
            var method = s.method || 'withPing';
            var pingMs = typeof s.pingMs === 'number' ? s.pingMs : 20;
            var autoApply = typeof s.autoApply === 'boolean' ? s.autoApply : true;
            var conv = calcConv(msg.rawWpm, msg.letters, msg.timeSec, method, pingMs);
            if (autoApply && conv != null && sender.tab && sender.tab.id) {
                chrome.tabs.sendMessage(sender.tab.id, { action: 'setWpm', wpm: conv }).catch(function(){});
            }
            chrome.storage.local.set({ lastRaw: msg.rawWpm, lastConv: conv }, function() {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function(){});
            });
        });
    }

    if (msg.action === 'historyUpdate') {
        chrome.storage.local.get(['method', 'pingMs', 'testHistory'], function(s) {
            var method = s.method || 'withPing';
            var pingMs = typeof s.pingMs === 'number' ? s.pingMs : 20;
            var hist = Array.isArray(s.testHistory) ? s.testHistory : [];
            var conv = calcConv(msg.rawWpm, msg.letters, msg.timeSec, method, pingMs);
            if (conv == null) conv = msg.rawWpm;
            hist.push({ raw: msg.rawWpm, conv: conv, word: msg.word, failed: !!msg.failed });
            if (hist.length > 50) hist = hist.slice(-50);
            chrome.storage.local.set({ testHistory: hist }, function() {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function(){});
            });
        });
    }

    if (msg.action === 'checkUpdate') {
        fetch(UPDATE_URL)
            .then(function(r){ return r.json(); })
            .then(function(data) {
                respond({ tag: data.tag_name || null, url: data.html_url || null });
            })
            .catch(function(){ respond({ tag: null, url: null }); });
        return true; // keep channel open for async
    }
});

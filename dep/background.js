// made by x01ka
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
                chrome.tabs.sendMessage(sender.tab.id, { action: 'setWpm', wpm: conv }).catch(()=>{});
            }

            chrome.storage.local.set({ lastRaw: msg.rawWpm, lastConv: conv }, function() {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(()=>{});
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

            hist.push({ raw: msg.rawWpm, conv: conv, word: msg.word });
            if (hist.length > 50) hist = hist.slice(-50);

            chrome.storage.local.set({ testHistory: hist }, function() {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(()=>{});
            });
        });
    }
});
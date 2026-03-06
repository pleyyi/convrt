// made by x01ka
var UPDATE_URL = 'https://api.github.com/repos/pleyyi/convrt/releases/latest';

function calcConv(raw, letters, timeSec, method, pingMs) {
    if (raw == null) return null;
    if (method === 'x135') return +(raw * 1.35).toFixed(1);
    if (!letters || !timeSec || timeSec <= 0) return null;
    var mult = (method === 'withPing') ? (17 - pingMs * 0.085) : 17;
    return +((letters / timeSec) * mult).toFixed(1);
}

chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
    if (msg.action === 'rawChanged') {
        chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function (s) {
            var method = s.method || 'withPing';
            var pingMs = typeof s.pingMs === 'number' ? s.pingMs : 20;
            var conv = calcConv(msg.rawWpm, msg.letters, msg.timeSec, method, pingMs);
            if (s.autoApply && sender.tab) {
                chrome.tabs.sendMessage(sender.tab.id, { action: 'setWpm', wpm: conv || msg.rawWpm }).catch(function () { });
            }
            chrome.storage.local.set({
                lastRaw: msg.rawWpm,
                lastConv: conv,
                lastLetters: msg.letters,
                lastTimeSec: msg.timeSec
            }, function () {
                chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function () { });
            });
        });
    }

    if (msg.action === 'historyUpdate') {
        chrome.storage.local.get(['method', 'pingMs', 'testHistory'], function (s) {
            var hist = Array.isArray(s.testHistory) ? s.testHistory : [];
            var conv = calcConv(msg.rawWpm, msg.letters, msg.timeSec, s.method || 'withPing', s.pingMs || 20);
            var entry = { raw: msg.rawWpm, conv: conv || msg.rawWpm, word: msg.word || '—', failed: !!msg.failed };

            var isDup = hist.length > 0 && hist[hist.length - 1].raw === entry.raw && hist[hist.length - 1].word === entry.word;
            if (!isDup) {
                hist.push(entry);
                if (hist.length > 50) hist = hist.slice(-50);
                chrome.storage.local.set({ testHistory: hist }, function () {
                    chrome.runtime.sendMessage({ action: 'popupUpdate' }).catch(function () { });
                });
            }
        });
    }

    if (msg.action === 'reapply') {
        chrome.storage.local.get(['method', 'pingMs', 'autoApply', 'lastRaw', 'lastLetters', 'lastTimeSec'], function (s) {
            if (!s.autoApply || s.lastRaw == null) return;
            var conv = calcConv(s.lastRaw, s.lastLetters, s.lastTimeSec, s.method, s.pingMs);
            chrome.storage.local.set({ lastConv: conv });
            chrome.tabs.query({ url: 'https://monkeytype.com/*' }, function (tabs) {
                tabs.forEach(function (t) { chrome.tabs.sendMessage(t.id, { action: 'setWpm', wpm: conv || s.lastRaw }).catch(function () { }); });
            });
        });
    }

    if (msg.action === 'checkUpdate') {
        fetch(UPDATE_URL).then(r => r.json()).then(d => respond({ tag: d.tag_name, url: d.html_url })).catch(() => respond({}));
        return true;
    }
});
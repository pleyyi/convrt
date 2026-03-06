// made by x01ka
var CURRENT_VERSION = '1.1.0';
var DISMISS_MS = 5 * 60 * 1000;
var testHistory = [];
var method = 'withPing';
var pingMs = 20;
var autoApply = true;

function isNewer(curr, latest) {
    var c = curr.replace(/[^0-9.]/g, '').split('.').map(Number);
    var l = latest.replace(/[^0-9.]/g, '').split('.').map(Number);
    for (var i = 0; i < Math.max(c.length, l.length); i++) {
        var cv = c[i] || 0;
        var lv = l[i] || 0;
        if (lv > cv) return true;
        if (lv < cv) return false;
    }
    return false;
}

function saveState() {
    chrome.storage.local.set({ method: method, pingMs: pingMs, autoApply: autoApply });
}

function saveAndReapply() {
    saveState();
    chrome.runtime.sendMessage({ action: 'reapply' }).catch(function () { });
}

function formulaLabel() {
    if (method === 'x135') return 'raw × 1.35';
    if (method === 'withPing') {
        var m = (17 - pingMs * 0.085).toFixed(2).replace(/\.?0+$/, '');
        return '(l÷t) × ' + m;
    }
    return '(l÷t) × 17';
}

function renderHistory() {
    var scroll = document.getElementById('histScroll');
    var clearBtn = document.getElementById('clearHistBtn');
    if (!testHistory || testHistory.length === 0) {
        scroll.innerHTML = '<div class="empty">no tests yet</div>';
        clearBtn.style.display = 'none';
        return;
    }
    clearBtn.style.display = 'inline-block';
    scroll.innerHTML = '';
    var reversed = testHistory.slice().reverse();
    for (var i = 0; i < reversed.length; i++) {
        var e = reversed[i];
        var row = document.createElement('div');
        row.className = 'hist-row' + (e.failed ? ' failed-row' : '');
        row.innerHTML =
            '<div class="hr-word">' + (e.word || '—') + '</div>' +
            '<div class="hr-nums">' +
            '<span class="hr-raw">' + (e.raw != null ? e.raw : '?') + '</span>' +
            '<span class="hr-arr">→</span>' +
            '<span class="hr-conv">' + (e.conv != null ? e.conv : '?') + '</span>' +
            '</div>';
        scroll.appendChild(row);
    }
}

function updateFromStorage() {
    chrome.storage.local.get(['testHistory', 'lastRaw', 'lastConv', 'method', 'pingMs', 'autoApply'], function (s) {
        if (s.method) method = s.method;
        if (typeof s.pingMs === 'number') pingMs = s.pingMs;
        if (typeof s.autoApply === 'boolean') autoApply = s.autoApply;
        if (Array.isArray(s.testHistory)) testHistory = s.testHistory;
        document.getElementById('rawNum').textContent = s.lastRaw != null ? s.lastRaw : '—';
        document.getElementById('convNum').textContent = s.lastConv != null ? s.lastConv : '—';
        document.getElementById('statusDot').classList.toggle('live', s.lastRaw != null);
        document.getElementById('chip').textContent = formulaLabel();
        renderHistory();
    });
}

chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.action === 'popupUpdate') updateFromStorage();
});

function applyMethodUI(m) {
    document.querySelectorAll('.mbtn').forEach(function (b) { b.classList.remove('active'); });
    var map = { withPing: 'mWithPing', zeroPing: 'mZeroPing', x135: 'mX135' };
    document.getElementById(map[m]).classList.add('active');
    document.getElementById('pingBlock').classList.toggle('locked', m !== 'withPing');
    document.getElementById('chip').textContent = formulaLabel();
}

function applyToggleUI(val) {
    var tog = document.getElementById('toggleBtn');
    if (val) tog.classList.add('on'); else tog.classList.remove('on');
}

document.getElementById('mWithPing').addEventListener('click', function () { method = 'withPing'; applyMethodUI(method); saveAndReapply(); });
document.getElementById('mZeroPing').addEventListener('click', function () { method = 'zeroPing'; applyMethodUI(method); saveAndReapply(); });
document.getElementById('mX135').addEventListener('click', function () { method = 'x135'; applyMethodUI(method); saveAndReapply(); });
document.getElementById('pingSlider').addEventListener('input', function () {
    pingMs = parseInt(this.value, 10);
    document.getElementById('pingNum').textContent = '+' + pingMs + 'ms';
    document.getElementById('chip').textContent = formulaLabel();
    saveAndReapply();
});
document.getElementById('toggleBtn').addEventListener('click', function () { autoApply = !autoApply; applyToggleUI(autoApply); saveState(); });
document.getElementById('resetPingBtn').addEventListener('click', function () {
    pingMs = 20;
    document.getElementById('pingSlider').value = 20;
    document.getElementById('pingNum').textContent = '+20ms';
    document.getElementById('chip').textContent = formulaLabel();
    saveAndReapply();
});
document.getElementById('clearHistBtn').addEventListener('click', function () {
    testHistory = [];
    chrome.storage.local.set({ testHistory: [] }, function () { renderHistory(); });
});
document.getElementById('rfBtn').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'forceUpdate' }).catch(function () { });
    });
});

function checkForUpdate() {
    chrome.storage.local.get(['updateDismissedAt'], function (s) {
        var dismissedAt = s.updateDismissedAt || 0;
        if ((Date.now() - dismissedAt) < DISMISS_MS) return;
        chrome.runtime.sendMessage({ action: 'checkUpdate' }, function (resp) {
            if (chrome.runtime.lastError || !resp || !resp.tag) return;
            if (isNewer(CURRENT_VERSION, resp.tag)) {
                var banner = document.getElementById('updateBanner');
                if (banner) {
                    document.getElementById('updateText').textContent = 'new: ' + resp.tag;
                    document.getElementById('updateLink').href = resp.url;
                    banner.style.display = 'flex';
                }
            }
        });
    });
}

chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function (s) {
    if (s.method) method = s.method;
    if (typeof s.pingMs === 'number') pingMs = s.pingMs;
    if (typeof s.autoApply === 'boolean') autoApply = s.autoApply;
    applyMethodUI(method);
    applyToggleUI(autoApply);
    document.getElementById('pingSlider').value = pingMs;
    document.getElementById('pingNum').textContent = '+' + pingMs + 'ms';
    updateFromStorage();
    checkForUpdate();
});
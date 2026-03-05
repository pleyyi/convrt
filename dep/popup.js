// made by x01ka — v1.0.5
var CURRENT_VERSION = 'v1.0.5';
var DISMISS_MS = 5 * 60 * 1000; // 5 minutes

var testHistory = [];
var method    = 'withPing';
var pingMs    = 20;
var autoApply = true;

function saveState() {
    chrome.storage.local.set({ method: method, pingMs: pingMs, autoApply: autoApply });
}

// Save settings AND tell background to reapply the conversion to open tabs
function saveAndReapply() {
    saveState();
    chrome.runtime.sendMessage({ action: 'reapply' }).catch(function () {});
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
    var scroll   = document.getElementById('histScroll');
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
        var e   = reversed[i];
        var row = document.createElement('div');
        row.className = 'hist-row' + (e.failed ? ' failed-row' : '');
        row.innerHTML =
            '<div class="hr-word">' + (e.word || '—') + '</div>' +
            (e.failed ? '<div class="hr-fail-tag">fail</div>' : '') +
            '<div class="hr-nums">' +
                '<span class="hr-raw">'  + (e.raw  != null ? e.raw  : '?') + '</span>' +
                '<span class="hr-arr">→</span>' +
                '<span class="hr-conv">' + (e.conv != null ? e.conv : '?') + '</span>' +
            '</div>';
        scroll.appendChild(row);
    }
}

function updateFromStorage() {
    chrome.storage.local.get(
        ['testHistory', 'lastRaw', 'lastConv', 'method', 'pingMs', 'autoApply'],
        function (s) {
            if (s.method)                         method    = s.method;
            if (typeof s.pingMs    === 'number')  pingMs    = s.pingMs;
            if (typeof s.autoApply === 'boolean') autoApply = s.autoApply;

            if (Array.isArray(s.testHistory)) testHistory = s.testHistory;

            document.getElementById('rawNum').textContent  = s.lastRaw  != null ? s.lastRaw  : '—';
            document.getElementById('convNum').textContent = s.lastConv != null ? s.lastConv : '—';
            document.getElementById('statusDot').classList.toggle('live', s.lastRaw != null);
            document.getElementById('chip').textContent = formulaLabel();

            renderHistory();
        }
    );
}

chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.action === 'popupUpdate') updateFromStorage();
});

// ── method / ping UI ─────────────────────────────────────────────────────────

function applyMethodUI(m) {
    document.querySelectorAll('.mbtn').forEach(function (b) { b.classList.remove('active'); });
    var map = { withPing: 'mWithPing', zeroPing: 'mZeroPing', x135: 'mX135' };
    var id = map[m];
    if (id) document.getElementById(id).classList.add('active');
    document.getElementById('pingBlock').classList.toggle('locked', m !== 'withPing');
    document.getElementById('chip').textContent = formulaLabel();
}

function applyToggleUI(val) {
    var tog = document.getElementById('toggleBtn');
    if (val) tog.classList.add('on'); else tog.classList.remove('on');
}

document.getElementById('mWithPing').addEventListener('click', function () {
    method = 'withPing'; applyMethodUI(method); saveAndReapply();
});
document.getElementById('mZeroPing').addEventListener('click', function () {
    method = 'zeroPing'; applyMethodUI(method); saveAndReapply();
});
document.getElementById('mX135').addEventListener('click', function () {
    method = 'x135'; applyMethodUI(method); saveAndReapply();
});

document.getElementById('pingSlider').addEventListener('input', function () {
    pingMs = parseInt(this.value, 10);
    document.getElementById('pingNum').textContent = '+' + pingMs + 'ms';
    document.getElementById('chip').textContent = formulaLabel();
    saveAndReapply();
});

document.getElementById('toggleBtn').addEventListener('click', function () {
    autoApply = !autoApply;
    applyToggleUI(autoApply);
    saveState();
});

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
        if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'forceUpdate' }).catch(function () {});
        }
    });
});

// ── update banner ─────────────────────────────────────────────────────────────

document.getElementById('dismissBtn').addEventListener('click', function () {
    document.getElementById('updateBanner').classList.remove('show');
    chrome.storage.local.set({ updateDismissedAt: Date.now() });
});

function checkForUpdate() {
    chrome.storage.local.get(['updateDismissedAt'], function (s) {
        var dismissedAt = typeof s.updateDismissedAt === 'number' ? s.updateDismissedAt : 0;
        if ((Date.now() - dismissedAt) < DISMISS_MS) return;

        chrome.runtime.sendMessage({ action: 'checkUpdate' }, function (resp) {
            if (chrome.runtime.lastError) return;
            if (!resp || !resp.tag) return;
            if (resp.tag !== CURRENT_VERSION) {
                document.getElementById('updateText').textContent = 'update available: ' + resp.tag;
                document.getElementById('updateLink').href = resp.url || 'https://github.com/pleyyi/convrt/releases/latest';
                document.getElementById('updateBanner').classList.add('show');
            }
        });
    });
}

// ── init ──────────────────────────────────────────────────────────────────────

chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function (s) {
    if (s.method)                         method    = s.method;
    if (typeof s.pingMs    === 'number')  pingMs    = s.pingMs;
    if (typeof s.autoApply === 'boolean') autoApply = s.autoApply;

    applyMethodUI(method);
    applyToggleUI(autoApply);
    document.getElementById('pingSlider').value = pingMs;
    document.getElementById('pingNum').textContent = '+' + pingMs + 'ms';

    updateFromStorage();
    checkForUpdate();
});

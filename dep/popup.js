// made by x01ka
var testHistory = [];
var method = 'withPing';
var pingMs = 20;
var rawWpm = null;
var autoApply = true;

function saveState() {
    chrome.storage.local.set({ method: method, pingMs: pingMs, autoApply: autoApply });
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
    if (testHistory.length === 0) {
        scroll.innerHTML = '<div class="empty">no tests yet</div>';
        clearBtn.style.display = 'none';
        return;
    }
    clearBtn.style.display = 'inline-block';
    scroll.innerHTML = '';
    
    testHistory.slice().reverse().forEach(function (e) {
        var row = document.createElement('div');
        row.className = 'hist-row';
        row.innerHTML =
            '<div class="hr-word">' + (e.word || '—') + '</div>' +
            '<div class="hr-nums">' +
                '<span class="hr-raw">' + (e.raw || 0) + '</span>' +
                '<span class="hr-arr">→</span>' +
                '<span class="hr-conv">' + (e.conv || 0) + '</span>' +
            '</div>';
        scroll.appendChild(row);
    });
}

function updateFromStorage() {
    chrome.storage.local.get(['testHistory', 'lastRaw', 'lastConv', 'method', 'pingMs', 'autoApply'], function (s) {
        if (Array.isArray(s.testHistory)) testHistory = s.testHistory;
        
        document.getElementById('rawNum').textContent = s.lastRaw != null ? s.lastRaw : '—';
        document.getElementById('convNum').textContent = s.lastConv != null ? s.lastConv : '—';
        
        document.getElementById('statusDot').classList.toggle('live', s.lastRaw != null);
        document.getElementById('chip').textContent = formulaLabel();
        
        renderHistory();
    });
}

chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.action === 'popupUpdate') {
        updateFromStorage();
    }
});

function applyMethodUI(m) {
    document.querySelectorAll('.mbtn').forEach(function (b) { b.classList.remove('active'); });
    var map = { withPing: 'mWithPing', zeroPing: 'mZeroPing', x135: 'mX135' };
    document.getElementById(map[m]).classList.add('active');
    document.getElementById('pingBlock').classList.toggle('locked', m !== 'withPing');
}

function applyToggleUI(val) {
    var tog = document.getElementById('toggleBtn');
    if (val) tog.classList.add('on'); else tog.classList.remove('on');
}

document.getElementById('mWithPing').addEventListener('click', function () { method = 'withPing'; saveState(); applyMethodUI(method); updateFromStorage(); });
document.getElementById('mZeroPing').addEventListener('click', function () { method = 'zeroPing'; saveState(); applyMethodUI(method); updateFromStorage(); });
document.getElementById('mX135').addEventListener('click', function () { method = 'x135'; saveState(); applyMethodUI(method); updateFromStorage(); });

document.getElementById('pingSlider').addEventListener('input', function () {
    pingMs = parseInt(this.value, 10);
    document.getElementById('pingNum').textContent = '+' + pingMs + 'ms';
    saveState();
});

document.getElementById('toggleBtn').addEventListener('click', function () {
    autoApply = !autoApply;
    applyToggleUI(autoApply);
    saveState();
});

document.getElementById('resetPingBtn').addEventListener('click', function () {
    pingMs = 20;
    document.getElementById('pingSlider').value = pingMs;
    document.getElementById('pingNum').textContent = '+20ms';
    saveState();
});

document.getElementById('clearHistBtn').addEventListener('click', function () {
    testHistory = [];
    chrome.storage.local.set({ testHistory: [] }, function() {
        renderHistory();
    });
});

document.getElementById('rfBtn').addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'forceUpdate' }).catch(()=>{});
        }
    });
});

chrome.storage.local.get(['method', 'pingMs', 'autoApply'], function (s) {
    if (s.method) method = s.method;
    if (typeof s.pingMs === 'number') pingMs = s.pingMs;
    if (typeof s.autoApply === 'boolean') autoApply = s.autoApply;

    applyMethodUI(method);
    applyToggleUI(autoApply);
    document.getElementById('pingSlider').value = pingMs;
    document.getElementById('pingNum').textContent = '+' + pingMs + 'ms';
    
    updateFromStorage();
});
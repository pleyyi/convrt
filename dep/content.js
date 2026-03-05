// made by x01ka — v1.0.5
(function () {
    var fireTimer  = null;
    var prevRaw    = null; // raw WPM value from LAST fire — used to detect test-end transition
    var dead       = false;
    var observer   = null;

    // ── context guard ────────────────────────────────────────────────────────

    function isAlive() {
        if (dead) return false;
        try {
            if (!chrome.runtime || !chrome.runtime.id) { shutdown(); return false; }
        } catch (e) { shutdown(); return false; }
        return true;
    }

    function shutdown() {
        dead = true;
        clearTimeout(fireTimer);
        if (observer) { try { observer.disconnect(); } catch (e) {} }
    }

    function safeSend(msg) {
        if (!isAlive()) return;
        try {
            chrome.runtime.sendMessage(msg).catch(function (e) {
                if (e && e.message && e.message.indexOf('Extension context') !== -1) shutdown();
            });
        } catch (e) { shutdown(); }
    }

    // ── DOM helpers ──────────────────────────────────────────────────────────

    // Raw WPM — only populated on the result screen by monkeytype.
    // Going null→value = test just finished.
    // Going value→null = new test starting.
    function getRawWpm() {
        var el = document.querySelector('.group.raw .bottom');
        if (!el) return null;
        var v = parseFloat(el.textContent.trim());
        return isFinite(v) && v > 0 ? v : null;
    }

    function getTimeSeconds() {
        var el = document.querySelector('.group.time .bottom .text');
        if (!el) return null;
        var m = el.textContent.trim().match(/([\d.]+)/);
        return m ? (parseFloat(m[1]) || null) : null;
    }

    // The last word the user typed — best effort from the word list
    function getLastWord() {
        var els = document.querySelectorAll('.words .word[input]');
        if (!els.length) return null;
        // walk backwards to find the last non-empty input
        for (var i = els.length - 1; i >= 0; i--) {
            var val = els[i].getAttribute('input');
            if (val && val.trim().length > 0) return val.trim();
        }
        return null;
    }

    function isFailed() {
        var res = document.querySelector('#result');
        if (res && res.classList.contains('fail')) return true;
        if (document.querySelector('#result .fail')) return true;
        return false;
    }

    function setWpmDisplay(wpm) {
        var el = document.querySelector('.group.wpm .bottom');
        if (!el) return false;
        el.textContent = wpm;
        return true;
    }

    // ── fire ─────────────────────────────────────────────────────────────────

    function doFire(force) {
        if (!isAlive()) return;

        var raw  = getRawWpm();
        var time = getTimeSeconds();

        // ── test just FINISHED: raw went null → value ──
        // This is the reliable "done" signal the user described.
        if (raw != null && prevRaw == null) {
            var word = getLastWord();
            safeSend({
                action:  'historyUpdate',
                word:    word || '—',
                rawWpm:  raw,
                letters: word ? word.replace(/\s/g, '').length : null,
                timeSec: time,
                failed:  isFailed()
            });
            // also push rawChanged so the popup display updates
            safeSend({
                action:  'rawChanged',
                rawWpm:  raw,
                letters: word ? word.replace(/\s/g, '').length : null,
                timeSec: time
            });
        }

        // ── raw changed during result screen (e.g. forced refresh) ──
        if (raw != null && raw !== prevRaw && prevRaw != null) {
            safeSend({
                action:  'rawChanged',
                rawWpm:  raw,
                letters: null,
                timeSec: time
            });
        }

        prevRaw = raw;
    }

    function schedFire() {
        if (!isAlive()) return;
        clearTimeout(fireTimer);
        fireTimer = setTimeout(doFire, 80);
    }

    observer = new MutationObserver(schedFire);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    try {
        chrome.runtime.onMessage.addListener(function (msg, _sender, respond) {
            if (!isAlive()) return;
            if (msg.action === 'setWpm') {
                respond({ ok: setWpmDisplay(msg.wpm) });
                return true;
            }
            if (msg.action === 'forceUpdate') {
                doFire(true);
                respond({ ok: true });
                return true;
            }
        });
    } catch (e) { shutdown(); }
})();

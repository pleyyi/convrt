// made by x01ka
(function () {
    var fireTimer = null;
    var prevRaw = null;
    var observer = null;

    function getRawWpm() {
        var res = document.getElementById('result');
        if (!res || res.classList.contains('hidden')) return null;
        var el = document.querySelector('.group.raw .bottom');
        if (!el) return null;
        var v = parseFloat(el.textContent.trim());
        return isFinite(v) && v > 0 ? v : null;
    }

    function doFire() {
        var raw = getRawWpm();
        if (raw != null && prevRaw == null) {
            var wordEl = document.querySelector('.words .word[input], #words .word[input]');
            var word = wordEl ? wordEl.getAttribute('input') : null;
            var timeEl = document.querySelector('.group.time .bottom');
            var time = timeEl ? parseFloat(timeEl.textContent.match(/[\d.]+/)) : null;

            chrome.runtime.sendMessage({
                action: 'historyUpdate',
                word: word,
                rawWpm: raw,
                letters: word ? word.length : null,
                timeSec: time,
                failed: !!document.querySelector('#result.fail, #result .fail')
            }).catch(function () { });

            chrome.runtime.sendMessage({
                action: 'rawChanged',
                rawWpm: raw,
                letters: word ? word.length : null,
                timeSec: time
            }).catch(function () { });
        }
        prevRaw = raw;
    }

    observer = new MutationObserver(function () {
        clearTimeout(fireTimer);
        fireTimer = setTimeout(doFire, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    chrome.runtime.onMessage.addListener(function (msg, _s, res) {
        if (msg.action === 'setWpm') {
            var el = document.querySelector('.group.wpm .bottom');
            if (el) el.textContent = msg.wpm;
            res({ ok: !!el });
        }
        if (msg.action === 'forceUpdate') { prevRaw = null; doFire(); res({ ok: true }); }
    });
})();
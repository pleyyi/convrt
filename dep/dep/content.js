// made by x01ka — v1.0.5
(function () {
    var lastRaw = null;
    var fireTimer = null;
    var lastWordCount = 0;
    var patchedLabel = false;
    var testDoneFired = false;

    function lettersFromWord(word) {
        return word ? word.replace(/\s/g, '').length : null;
    }

    function getTimeSeconds() {
        var el = document.querySelector('.group.time .bottom .text');
        if (!el) return null;
        var m = el.textContent.trim().match(/([\d.]+)/);
        return m ? (parseFloat(m[1]) || null) : null;
    }

    function getRawWpm() {
        var el = document.querySelector('.group.raw .bottom');
        if (!el) return null;
        var v = parseFloat(el.textContent.trim());
        return v > 0 ? v : null;
    }

    function getCompletedWords() {
        var els = document.querySelectorAll('.words .word[input]');
        var words = [];
        els.forEach(function (el) {
            var val = el.getAttribute('input');
            if (val && val.trim()) words.push(val.trim());
        });
        return words;
    }

    function isFailed() {
        return !!(document.querySelector('[data-testid="failed"]') || document.querySelector('.failed'));
    }

    function isTestDone() {
        if (document.querySelector('#result')) return true;
        if (isFailed()) return true;
        return false;
    }

    function setWpmDisplay(wpm) {
        var el = document.querySelector('.group.wpm .bottom');
        if (!el) return false;
        el.textContent = wpm;
        return true;
    }

    function patchWpmLabel() {
        if (patchedLabel) return;
        var el = document.querySelector('.group.wpm .text');
        if (el && el.textContent.trim().toLowerCase() === 'wpm') {
            el.textContent = 'wpm (cnvrt)';
            patchedLabel = true;
        }
    }

    function doFire(force) {
        patchWpmLabel();

        var raw = getRawWpm();
        var time = getTimeSeconds();
        var wordsArray = getCompletedWords();
        var currentWordCount = wordsArray.length;

        if (currentWordCount < lastWordCount) {
            lastWordCount = 0;
            testDoneFired = false;
        }

        var done = isTestDone();
        if (done && !testDoneFired) {
            testDoneFired = true;
            var lastWord = wordsArray[wordsArray.length - 1] || null;
            var savedRaw = lastRaw != null ? lastRaw : raw;
            if (savedRaw != null) {
                chrome.runtime.sendMessage({
                    action: 'historyUpdate',
                    word: lastWord || '—',
                    rawWpm: savedRaw,
                    letters: lettersFromWord(lastWord),
                    timeSec: time,
                    failed: isFailed()
                }).catch(function(){});
            }
        }

        if (!done && (currentWordCount > lastWordCount || force)) {
            var justWord = wordsArray[currentWordCount - 1] || null;
            var savedRaw2 = lastRaw != null ? lastRaw : raw;
            if (savedRaw2 != null && justWord) {
                chrome.runtime.sendMessage({
                    action: 'historyUpdate',
                    word: justWord,
                    rawWpm: savedRaw2,
                    letters: lettersFromWord(justWord),
                    timeSec: time,
                    failed: false
                }).catch(function(){});
            }
            lastWordCount = currentWordCount;
        }

        if (raw != null && (raw !== lastRaw || force)) {
            lastRaw = raw;
            var anyWord = wordsArray[wordsArray.length - 1] || null;
            chrome.runtime.sendMessage({
                action: 'rawChanged',
                rawWpm: raw,
                letters: lettersFromWord(anyWord),
                timeSec: time
            }).catch(function(){});
        }
    }

    function schedFire() {
        clearTimeout(fireTimer);
        fireTimer = setTimeout(doFire, 80);
    }

    new MutationObserver(schedFire).observe(document.body, {
        childList: true, subtree: true, characterData: true
    });

    chrome.runtime.onMessage.addListener(function (msg, _sender, respond) {
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

    patchWpmLabel();
})();

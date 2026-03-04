// made by x01ka
(function () {
    var lastRaw = null;
    var fireTimer = null;
    var lastWordCount = 0;

    function getLetterCount() {
        var el = document.querySelector('.group.key .bottom');
        if (!el) return null;
        var m = (el.getAttribute('aria-label') || '').match(/^(\d+)/);
        if (m) return parseInt(m[1], 10);
        var m2 = el.textContent.trim().match(/^(\d+)/);
        return m2 ? parseInt(m2[1], 10) : null;
    }

    function getTimeSeconds() {
        var el = document.querySelector('.group.time .bottom .text');
        return el ? (parseFloat(el.textContent.trim().match(/([\d.]+)/)?.[1]) || null) : null;
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
        els.forEach(el => {
            var val = el.getAttribute('input');
            if (val) words.push(val.trim());
        });
        return words;
    }

    function setWpmDisplay(wpm) {
        var el = document.querySelector('.group.wpm .bottom');
        if (!el) return false;
        el.textContent = wpm;
        return true;
    }

    function doFire(force) {
        var raw = getRawWpm();
        var letters = getLetterCount();
        var time = getTimeSeconds();
        
        var wordsArray = getCompletedWords();
        var currentWordCount = wordsArray.length;

        if (currentWordCount < lastWordCount) {
            lastWordCount = currentWordCount;
        }

        if (currentWordCount > lastWordCount || force) {
            var justCompletedWord = wordsArray[Math.max(0, currentWordCount - 2)];
            var savedRaw = lastRaw != null ? lastRaw : raw;

            if (savedRaw != null && justCompletedWord) {
                chrome.runtime.sendMessage({
                    action: 'historyUpdate',
                    word: justCompletedWord,
                    rawWpm: savedRaw,
                    letters: letters,
                    timeSec: time
                }).catch(()=>{});
            }
            lastWordCount = currentWordCount;
        }

        if (raw != null && (raw !== lastRaw || force)) {
            lastRaw = raw;
            chrome.runtime.sendMessage({
                action: 'rawChanged',
                rawWpm: raw,
                letters: letters,
                timeSec: time
            }).catch(()=>{});
        }
    }

    function fireIfChanged() {
        clearTimeout(fireTimer);
        fireTimer = setTimeout(doFire, 150);
    }

    new MutationObserver(fireIfChanged).observe(document.body, {
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
})();
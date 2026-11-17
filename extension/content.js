(() => {
  const DEFAULTS = {
    enabled: true,
    delayMs: 1500,
    beep: true,
    debug: true,
    customSelector: ""
  };
  let cfg = { ...DEFAULTS };
  let pending = null;
  let lastClick = 0;
  let scanTimer = null;

  const log = (...a) => cfg.debug && console.log("[AutoAnswer]", ...a);

  chrome.storage.local.get(DEFAULTS, (v) => { cfg = { ...DEFAULTS, ...v }; });
  chrome.storage.onChanged.addListener((changes) => {
    for (const k in changes) cfg[k] = changes[k].newValue;
  });

  // Heuristic matching, used only when no custom selector is set.
  // Replace with a stable selector (aria-label or data attribute) once confirmed on a live ring.
  const ANSWER_RE = /\b(answer|pick up|accept)\b/i;
  const BAD_RE = /\b(decline|reject|hang up|end call|voicemail|ignore|dial|transfer)\b/i;

  const visible = (el) =>
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  const labelOf = (el) =>
    [
      el.getAttribute("aria-label"),
      el.getAttribute("title"),
      el.getAttribute("data-test"),
      el.getAttribute("data-testid"),
      el.textContent
    ].filter(Boolean).join(" ").trim();

  function findAnswerButton() {
    if (cfg.customSelector) {
      try {
        const el = document.querySelector(cfg.customSelector);
        return el && visible(el) ? el : null;
      } catch (e) {
        log("Bad custom selector", e);
        return null;
      }
    }
    const candidates = document.querySelectorAll('button, [role="button"]');
    for (const el of candidates) {
      if (!visible(el) || el.disabled) continue;
      const label = labelOf(el);
      if (ANSWER_RE.test(label) && !BAD_RE.test(label)) {
        log("Candidate answer button:", label, el);
        return el;
      }
    }
    return null;
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      osc.onended = () => ctx.close();
    } catch (e) {
      log("Beep failed", e);
    }
  }

  function scan() {
    if (!cfg.enabled || pending) return;
    if (Date.now() - lastClick < 4000) return;
    if (!findAnswerButton()) return;

    log("Answer button found, answering in", cfg.delayMs, "ms");
    if (cfg.beep) beep();

    pending = setTimeout(() => {
      pending = null;
      // Re-check: caller may have hung up or agent may have answered manually.
      const btn = findAnswerButton();
      if (btn && cfg.enabled) {
        lastClick = Date.now();
        log("Clicking answer");
        btn.click();
      } else {
        log("Button gone before delay elapsed, skipping");
      }
    }, Math.max(0, Number(cfg.delayMs) || 0));
  }

  const observer = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => { scanTimer = null; scan(); }, 150);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true
  });

  log("Loaded in", location.href);
})();

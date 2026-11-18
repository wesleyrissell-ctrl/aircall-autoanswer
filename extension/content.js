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

  // Aircall's Accept button on an inbound ring, confirmed on a live call:
  //   <button type="button" data-test="pickup-button">
  // Only this button is ever clicked. Text matching was removed because after-call tags
  // such as "3_No_Answer_No_VM" matched it and were clicked in a loop.
  // If Aircall renames the button, auto-answer simply stops; set customSelector to override.
  const PICKUP_SELECTOR = 'button[data-test="pickup-button"]';

  const visible = (el) =>
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  // An answer button disappears once clicked; anything still around is not one.
  const clicked = new WeakSet();

  function findAnswerButton() {
    const selector = cfg.customSelector || PICKUP_SELECTOR;
    let els;
    try {
      els = document.querySelectorAll(selector);
    } catch (e) {
      log("Bad custom selector", e);
      return null;
    }
    for (const el of els) {
      if (!visible(el) || el.disabled || clicked.has(el)) continue;
      log("Answer button found:", selector, el);
      return el;
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
        clicked.add(btn);
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

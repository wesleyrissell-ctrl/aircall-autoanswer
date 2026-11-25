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

  // Clicks per Accept button. A button still showing after a click means the answer
  // didn't go through (for example a mic prompt was open), so it is retried, at most
  // MAX_CLICKS times and never faster than the 4s cooldown.
  const clicks = new WeakMap();
  const MAX_CLICKS = 3;

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
      if (!visible(el) || el.disabled || (clicks.get(el) || 0) >= MAX_CLICKS) continue;
      log("Answer button found:", selector, el);
      return el;
    }
    return null;
  }

  function beep(freq = 880, times = 1) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.2);
        if (i === times - 1) osc.onended = () => ctx.close();
      }
    } catch (e) {
      log("Beep failed", e);
    }
  }

  // Aircall can't answer without the microphone, so warn loudly instead of failing silently.
  // Island's default policy pre-allows the mic for [*.]aircall.io (AudioCaptureAllowedUrls).
  // That policy can still report "prompt" here while working fine, so only "denied" warns.
  let micState = "unknown";
  const BANNER_ID = "aircall-autoanswer-mic-warning";
  const BANNER_TEXT = {
    denied: "Auto-answer can't pick up calls: microphone access is blocked for Aircall. Click the icon at the left of the address bar, set Microphone to Allow, then reload this page."
  };

  function showMicBanner(state) {
    if (window.top !== window) return;
    let el = document.getElementById(BANNER_ID);
    if (!BANNER_TEXT[state]) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = BANNER_ID;
      Object.assign(el.style, {
        position: "fixed", top: "0", left: "0", right: "0", zIndex: "2147483647",
        padding: "10px 16px", background: "#b00020", color: "#fff",
        font: "600 14px system-ui, sans-serif", textAlign: "center"
      });
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = BANNER_TEXT[state];
  }

  function watchMic() {
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve();
    return navigator.permissions.query({ name: "microphone" }).then((status) => {
      const update = () => {
        micState = status.state;
        log("Microphone permission:", micState);
        showMicBanner(micState);
      };
      update();
      status.onchange = update;
    }).catch((e) => log("Mic permission check failed", e));
  }

  function scan() {
    if (!cfg.enabled || pending) return;
    if (Date.now() - lastClick < 4000) return;
    if (!findAnswerButton()) return;

    const micOk = micState !== "denied";
    log("Answer button found, answering in", cfg.delayMs, "ms; microphone:", micState);
    if (!micOk) {
      // Low double tone: ringing, but the mic isn't allowed. Still click, since that can
      // bring up Aircall's mic prompt for the agent.
      beep(440, 2);
      showMicBanner(micState);
    } else if (cfg.beep) {
      beep();
    }

    pending = setTimeout(() => {
      pending = null;
      // Re-check: caller may have hung up or agent may have answered manually.
      const btn = findAnswerButton();
      if (btn && cfg.enabled) {
        lastClick = Date.now();
        const n = (clicks.get(btn) || 0) + 1;
        clicks.set(btn, n);
        log("Clicking answer, try", n, "of", MAX_CLICKS);
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

  // Backup in case a ring arrives without a DOM change the observer catches
  // (or the observer's timer is throttled in a background tab).
  // Read the mic state first so a ring already showing at load gets the right tone.
  watchMic().finally(() => {
    scan();
    setInterval(scan, 1000);
  });

  log("Loaded", chrome.runtime.getManifest().version, "in", location.href);
})();

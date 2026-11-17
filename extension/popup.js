const DEFAULTS = { enabled: true, delayMs: 1500, beep: true, debug: true, customSelector: "" };
const ids = Object.keys(DEFAULTS);

chrome.storage.local.get(DEFAULTS, (v) => {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el.type === "checkbox") el.checked = v[id];
    else el.value = v[id];
  }
});

for (const id of ids) {
  document.getElementById(id).addEventListener("change", (e) => {
    const el = e.target;
    let val = el.type === "checkbox" ? el.checked : el.value;
    if (id === "delayMs") val = Number(val) || 0;
    chrome.storage.local.set({ [id]: val });
  });
}

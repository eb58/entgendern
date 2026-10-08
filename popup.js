const enabledInput = document.getElementById('enabled');
const siteInput = document.getElementById('site');
const hostLabel = document.getElementById('host');
const countLabel = document.getElementById('count');

let host = null;
let tabId = null;

function render(settings) {
  enabledInput.checked = settings.enabled !== false;
  siteInput.checked = !host || !settings.disabledHosts.includes(host);
  siteInput.disabled = !host || !enabledInput.checked;
}

function refreshCount() {
  if (tabId === null) return;
  chrome.tabs.sendMessage(tabId, { type: 'getStatus' }, (status) => {
    if (chrome.runtime.lastError || !status) {
      countLabel.textContent = 'Auf dieser Seite nicht verfügbar';
      return;
    }
    if (!status.active) countLabel.textContent = 'Pausiert';
    else if (status.count === 1) countLabel.textContent = '1 Stelle angepasst';
    else countLabel.textContent = `${status.count} Stellen angepasst`;
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) {
    tabId = tab.id;
    try {
      const url = new URL(tab.url);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:') host = url.hostname;
    } catch (e) {
      host = null;
    }
  }
  hostLabel.textContent = host || '–';
  chrome.storage.sync.get({ enabled: true, disabledHosts: [] }, render);
  refreshCount();
});

enabledInput.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledInput.checked });
});

siteInput.addEventListener('change', () => {
  chrome.storage.sync.get({ disabledHosts: [] }, ({ disabledHosts }) => {
    const set = new Set(disabledHosts);
    if (siteInput.checked) set.delete(host);
    else set.add(host);
    chrome.storage.sync.set({ disabledHosts: [...set] });
  });
});

chrome.storage.onChanged.addListener(() => {
  chrome.storage.sync.get({ enabled: true, disabledHosts: [] }, render);
  setTimeout(refreshCount, 150);
});

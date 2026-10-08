// Zeigt die Anzahl der Ersetzungen pro Tab als Badge am Erweiterungs-Icon.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'count' && sender.tab) {
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: msg.count > 0 ? String(msg.count > 999 ? '999+' : msg.count) : '',
    });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#2f6f62' });
  }
});

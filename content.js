/*
 * Entgendern – Content Script.
 * Ersetzt Text in der Seite, beobachtet nachgeladene Inhalte und kann alles
 * wieder auf den Originaltext zurücksetzen.
 */
(() => {
  'use strict';

  const { entgendern } = globalThis.Entgendern;

  const SKIP_SELECTOR = [
    'script', 'style', 'noscript', 'template', 'textarea', 'input', 'select',
    'code', 'pre', 'kbd', 'samp', 'svg', 'math',
    '[contenteditable=""]', '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
  ].join(',');
  const ATTRIBUTES = ['title', 'alt', 'placeholder', 'aria-label'];

  // Text-Knoten → { original, replaced }, damit wir zurücksetzen können.
  const textOriginals = new WeakMap();
  // Element → { attr: { original, replaced } }
  const attrOriginals = new WeakMap();
  let active = false;
  let settingsLoaded = false;
  let count = 0;
  const pending = new Set(); // Knoten, deren Teilbaum neu geprüft wird
  const pendingAttrs = new Set(); // Elemente mit geänderten Attributen
  let scheduled = false;

  function shouldSkip(el) {
    if (!el) return true;
    return el.closest(SKIP_SELECTOR) !== null || el.isContentEditable;
  }

  function processTextNode(node) {
    const value = node.nodeValue;
    const stored = textOriginals.get(node);
    if (stored && stored.replaced === value) return; // bereits bearbeitet
    if (shouldSkip(node.parentElement)) return;
    const result = entgendern(value);
    if (result.count === 0) return;
    textOriginals.set(node, { original: value, replaced: result.text });
    node.nodeValue = result.text;
    count += result.count;
  }

  function processAttributes(el) {
    for (const attr of ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const stored = attrOriginals.get(el) || {};
      if (stored[attr] && stored[attr].replaced === value) continue;
      const result = entgendern(value);
      if (result.count === 0) continue;
      stored[attr] = { original: value, replaced: result.text };
      attrOriginals.set(el, stored);
      el.setAttribute(attr, result.text);
      count += result.count;
    }
  }

  function processTree(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches(SKIP_SELECTOR)) {
        if (root.matches('input, textarea')) processAttributes(root);
        return;
      }
      processAttributes(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          return n.matches(SKIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(processTextNode);
    if (root.querySelectorAll) {
      root.querySelectorAll(ATTRIBUTES.map((a) => `[${a}]`).join(',')).forEach((el) => {
        if (!shouldSkip(el) || el.matches('input, textarea')) processAttributes(el);
      });
    }
  }

  // ---------- Beobachten ----------

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') pending.add(m.target);
      else if (m.type === 'attributes') pendingAttrs.add(m.target);
      else m.addedNodes.forEach((n) => pending.add(n));
    }
    schedule();
  });

  function observe() {
    observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
  }

  function schedule() {
    if (scheduled || !settingsLoaded || !active) return;
    scheduled = true;
    setTimeout(flush, 50);
  }

  function flush() {
    scheduled = false;
    if (!active) {
      pending.clear();
      pendingAttrs.clear();
      return;
    }
    const before = count;
    // Eigene Änderungen sollen keine neuen Mutationen auslösen.
    observer.disconnect();
    pending.forEach((n) => {
      if (n.isConnected) processTree(n);
    });
    pendingAttrs.forEach((el) => {
      if (el.isConnected) processAttributes(el);
    });
    pending.clear();
    pendingAttrs.clear();
    observe();
    if (count !== before) reportCount();
  }

  function restore() {
    observer.disconnect();
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const stored = textOriginals.get(node);
      if (stored && node.nodeValue === stored.replaced) node.nodeValue = stored.original;
      textOriginals.delete(node);
    }
    document.querySelectorAll(ATTRIBUTES.map((a) => `[${a}]`).join(',')).forEach((el) => {
      const stored = attrOriginals.get(el);
      if (!stored) return;
      for (const [attr, { original, replaced }] of Object.entries(stored)) {
        if (el.getAttribute(attr) === replaced) el.setAttribute(attr, original);
      }
      attrOriginals.delete(el);
    });
    count = 0;
    reportCount();
    // Weiter beobachten, damit ein erneutes Aktivieren nachgeladene Inhalte kennt.
    observe();
  }

  function reportCount() {
    try {
      chrome.runtime.sendMessage({ type: 'count', count });
    } catch (e) {
      // Erweiterung wurde neu geladen – dieses Skript ist verwaist.
    }
  }

  // ---------- Einstellungen ----------

  function applySettings(settings) {
    const disabledHosts = settings.disabledHosts || [];
    const shouldBeActive = settings.enabled !== false && !disabledHosts.includes(location.hostname);
    settingsLoaded = true;
    if (shouldBeActive === active) return;
    active = shouldBeActive;
    if (active) {
      pending.add(document);
      schedule();
    } else {
      pending.clear();
      restore();
    }
  }

  chrome.storage.sync.get({ enabled: true, disabledHosts: [] }, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    chrome.storage.sync.get({ enabled: true, disabledHosts: [] }, applySettings);
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'getStatus') {
      sendResponse({ count, active, host: location.hostname });
    }
  });

  observe();
})();

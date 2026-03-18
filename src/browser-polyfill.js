'use strict';

// ── Cross-browser API polyfill ──────────────────────────────────────────────
// Normalises the extension API namespace so the same code runs on Chrome,
// Safari, and Firefox.  Safari Web Extensions support the `browser.*`
// namespace with Promises; Chrome uses `chrome.*` with callbacks.
//
// After this script executes, `browser.*` is available everywhere:
//   - On Firefox / Safari it is the native `browser` object.
//   - On Chrome it wraps `chrome.*` callbacks into Promises.
//
// Only the APIs actually used by Sandkey are wrapped.

(function () {
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime) {
    // Firefox / Safari — `browser` already exists with Promise support.
    return;
  }

  // Chrome — build a thin Promise wrapper around the callback-based API.
  const chrome = globalThis.chrome;
  if (!chrome) return;

  function promisify(fn) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        fn.call(this, ...args, result => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });
    };
  }

  globalThis.browser = {
    storage: {
      local: {
        get: promisify(chrome.storage.local.get.bind(chrome.storage.local)),
        set: promisify(chrome.storage.local.set.bind(chrome.storage.local)),
      },
    },
    runtime: {
      getURL:       chrome.runtime.getURL.bind(chrome.runtime),
      openOptionsPage: chrome.runtime.openOptionsPage.bind(chrome.runtime),
      onMessage:    chrome.runtime.onMessage,
      sendMessage:  promisify(chrome.runtime.sendMessage.bind(chrome.runtime)),
    },
    tabs: {
      query:       promisify(chrome.tabs.query.bind(chrome.tabs)),
      sendMessage: promisify(chrome.tabs.sendMessage.bind(chrome.tabs)),
    },
  };
})();

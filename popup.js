'use strict';

// Shared domain matching logic (duplicated from content.js for use in popup context)
function domainScore(hostname, pattern) {
  hostname = hostname.toLowerCase();
  pattern = pattern.trim().toLowerCase();
  if (!pattern) return -1;
  if (pattern === hostname) return 10000 + hostname.length;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    const dotSuffix = '.' + suffix;
    if (hostname.endsWith(dotSuffix)) {
      const prefix = hostname.slice(0, hostname.length - dotSuffix.length);
      if (prefix) return suffix.length;
    }
  }
  return -1;
}

function matchCredentials(hostname, credentials) {
  return credentials
    .map(c => ({
      c,
      score: Math.max(-1, ...(c.domains || []).map(d => domainScore(hostname, d)))
    }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ c }) => c);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let hostname = null;
  try {
    hostname = tab?.url ? new URL(tab.url).hostname : null;
  } catch { /* invalid URL */ }

  const domainEl = document.getElementById('current-domain');
  domainEl.textContent = hostname || '(special page)';

  if (!hostname) {
    const noMatch = document.getElementById('no-match');
    noMatch.hidden = false;
    document.getElementById('no-match-msg').textContent =
      'Sandkey is not available on this page.';
    document.getElementById('btn-add-cred').hidden = true;
    return;
  }

  const { credentials = [] } = await chrome.storage.local.get('credentials');
  const matches = matchCredentials(hostname, credentials);

  const noMatch = document.getElementById('no-match');
  const list = document.getElementById('matches-list');

  if (!matches.length) {
    noMatch.hidden = false;
    return;
  }

  noMatch.hidden = true;
  list.innerHTML = matches.map(cred => `
    <div class="match-item">
      <div class="match-info">
        <div class="match-user">${esc(cred.username || '(no username)')}</div>
        ${cred.label ? `<div class="match-label">${esc(cred.label)}</div>` : ''}
      </div>
      <button class="btn-fill" data-id="${esc(cred.id)}">Fill</button>
    </div>
  `).join('');

  list.querySelectorAll('.btn-fill').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cred = matches.find(c => c.id === btn.dataset.id);
      if (!cred) return;

      btn.textContent = '…';
      btn.disabled = true;

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'SANDKEY_FILL',
          username: cred.username || '',
          password: cred.password || '',
        });

        if (response?.ok) {
          window.close();
        } else {
          showError('No fields found on this page.');
          btn.textContent = 'Fill';
          btn.disabled = false;
        }
      } catch {
        showError('Reload the page and try again.');
        btn.textContent = 'Fill';
        btn.disabled = false;
      }
    });
  });
}

function showError(msg) {
  const existing = document.getElementById('popup-error');
  if (existing) existing.remove();
  const err = document.createElement('div');
  err.id = 'popup-error';
  err.textContent = msg;
  document.getElementById('content').appendChild(err);
  setTimeout(() => err.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('btn-add-cred').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});

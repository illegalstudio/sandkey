'use strict';

// ── Domain matching ──────────────────────────────────────────────────────────
// Returns a numeric score: higher = more specific match, -1 = no match.
// Exact match wins over wildcard. Among wildcards, longer suffix = more specific.
// *.test matches foo.test (one level only, like DNS wildcards).

function domainScore(hostname, pattern) {
  hostname = hostname.toLowerCase();
  pattern = pattern.trim().toLowerCase();
  if (!pattern) return -1;

  // Exact match
  if (pattern === hostname) return 10000 + hostname.length;

  // Wildcard: *.suffix matches foo.suffix but NOT foo.bar.suffix
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    const dotSuffix = '.' + suffix;
    if (hostname.endsWith(dotSuffix)) {
      const prefix = hostname.slice(0, hostname.length - dotSuffix.length);
      if (prefix && !prefix.includes('.')) return suffix.length;
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

// ── Storage ──────────────────────────────────────────────────────────────────

function loadCredentials() {
  return new Promise(resolve =>
    chrome.storage.local.get('credentials', d => resolve(d.credentials || []))
  );
}

// ── Form detection ───────────────────────────────────────────────────────────

function findPair(input) {
  const root = input.closest('form') || document.body;
  const all = [...root.querySelectorAll(
    'input:not([type=hidden]):not([type=submit]):not([type=button])' +
    ':not([type=checkbox]):not([type=radio]):not([type=file]):not([type=reset])'
  )];

  if (input.type === 'password') {
    const idx = all.indexOf(input);
    let user = null;
    for (let i = idx - 1; i >= 0; i--) {
      const t = all[i].type.toLowerCase();
      if (['text', 'email', 'tel'].includes(t)) { user = all[i]; break; }
    }
    return { pw: input, user };
  } else {
    const idx = all.indexOf(input);
    let pw = null;
    for (let i = idx + 1; i < all.length; i++) {
      if (all[i].type === 'password') { pw = all[i]; break; }
    }
    return { pw, user: input };
  }
}

// ── Autofill ─────────────────────────────────────────────────────────────────

function fillInput(el, value) {
  if (!el || el.disabled || el.readOnly) return;
  try {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter ? setter.call(el, value) : (el.value = value);
  } catch { el.value = value; }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Dropdown (Shadow DOM for CSS isolation) ───────────────────────────────────

const DROPDOWN_CSS = `
  :host { all: initial; font-family: system-ui, -apple-system, sans-serif; }

  .dp {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, .16);
    overflow: hidden;
  }

  .dp-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: .06em;
    text-transform: uppercase;
    user-select: none;
  }

  .dp-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
    gap: 10px;
    outline: none;
    transition: background .1s;
  }
  .dp-item:last-child { border-bottom: none; }
  .dp-item:hover,
  .dp-item:focus { background: #fffbeb; }

  .dp-info { flex: 1; min-width: 0; }
  .dp-user { font-size: 14px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dp-pass { font-size: 12px; color: #94a3b8; margin-top: 1px; letter-spacing: 2px; }

  .dp-label {
    font-size: 11px;
    color: #92400e;
    background: #fef3c7;
    padding: 2px 7px;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }
`;

let dropdownHost = null;
let dropdownCleanup = [];

function closeDropdown() {
  dropdownHost?.remove();
  dropdownHost = null;
  dropdownCleanup.forEach(fn => fn());
  dropdownCleanup = [];
}

function openDropdown(anchor, credentials, pair) {
  closeDropdown();
  if (!credentials.length || !pair.pw) return;

  const rect = anchor.getBoundingClientRect();

  dropdownHost = document.createElement('div');
  dropdownHost.setAttribute('data-sandkey-host', '');
  Object.assign(dropdownHost.style, {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 270)}px`,
    zIndex: '2147483647',
  });

  const shadow = dropdownHost.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = DROPDOWN_CSS;
  shadow.appendChild(style);

  const dp = document.createElement('div');
  dp.className = 'dp';
  shadow.appendChild(dp);

  // Header
  const head = document.createElement('div');
  head.className = 'dp-head';
  const iconUrl = chrome.runtime.getURL('icons/icon16.png');
  head.innerHTML = `<img src="${iconUrl}" style="width:13px;height:13px;object-fit:contain"><span>Sandkey</span>`;
  dp.appendChild(head);

  // Credential items
  credentials.forEach(cred => {
    const item = document.createElement('div');
    item.className = 'dp-item';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');

    const info = document.createElement('div');
    info.className = 'dp-info';

    const user = document.createElement('div');
    user.className = 'dp-user';
    user.textContent = cred.username || '(no username)';

    const pass = document.createElement('div');
    pass.className = 'dp-pass';
    pass.textContent = '••••••••';

    info.appendChild(user);
    info.appendChild(pass);
    item.appendChild(info);

    if (cred.label) {
      const lbl = document.createElement('div');
      lbl.className = 'dp-label';
      lbl.textContent = cred.label;
      item.appendChild(lbl);
    }

    const doFill = () => {
      fillInput(pair.user, cred.username || '');
      fillInput(pair.pw, cred.password || '');
      closeDropdown();
      pair.pw.focus();
    };

    // mousedown instead of click to fire before blur
    item.addEventListener('mousedown', e => { e.preventDefault(); doFill(); });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doFill(); }
    });

    dp.appendChild(item);
  });

  document.body.appendChild(dropdownHost);

  // Close on outside interaction
  const onClickOut = e => {
    if (!e.target.closest('[data-sandkey-host]')) closeDropdown();
  };
  const onKey = e => { if (e.key === 'Escape') closeDropdown(); };
  const onScroll = () => closeDropdown();

  setTimeout(() => {
    document.addEventListener('click', onClickOut, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  }, 50);

  dropdownCleanup = [
    () => document.removeEventListener('click', onClickOut, true),
    () => document.removeEventListener('keydown', onKey, true),
    () => window.removeEventListener('scroll', onScroll, { capture: true }),
  ];
}

// ── Focus handler ─────────────────────────────────────────────────────────────

async function onFocus(e) {
  const hostname = location.hostname;
  if (!hostname) return;

  const credentials = await loadCredentials();
  const matches = matchCredentials(hostname, credentials);
  if (!matches.length) return;

  const pair = findPair(e.target);
  if (!pair.pw) return;

  openDropdown(e.target, matches, pair);
}

// ── Attach listeners & scan ───────────────────────────────────────────────────

function bind(el) {
  if (el._sandkeyBound) return;
  el._sandkeyBound = true;
  el.addEventListener('focus', onFocus);
}

function scan() {
  document.querySelectorAll('input[type=password]').forEach(pw => {
    bind(pw);
    const { user } = findPair(pw);
    if (user) bind(user);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scan);
} else {
  scan();
}

// Watch for dynamically added inputs (SPAs, lazy-loaded forms)
new MutationObserver(scan).observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// ── Message handler (popup autofill) ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type !== 'SANDKEY_FILL') return false;

  const pws = [...document.querySelectorAll('input[type=password]')];
  if (!pws.length) {
    respond({ ok: false, reason: 'no_password_field' });
    return true;
  }

  const pair = findPair(pws[0]);
  fillInput(pair.user, msg.username || '');
  fillInput(pws[0], msg.password || '');
  respond({ ok: true });
  return true;
});

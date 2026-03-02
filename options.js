'use strict';

const STORAGE_KEY = 'credentials';
let creds = [];
let editId = null;

// ── Storage ───────────────────────────────────────────────────────────────────

const store = {
  load: () => new Promise(r =>
    chrome.storage.local.get(STORAGE_KEY, d => r(d[STORAGE_KEY] || []))
  ),
  save: () => new Promise(r =>
    chrome.storage.local.set({ [STORAGE_KEY]: creds }, r)
  ),
};

function uid() { return crypto.randomUUID(); }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render credential list ────────────────────────────────────────────────────

function render() {
  const list = document.getElementById('credentials-list');
  const empty = document.getElementById('empty-state');

  if (!creds.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  list.innerHTML = creds.map(c => `
    <div class="cred-card" data-id="${esc(c.id)}">
      <div class="cred-card-head">
        <div class="cred-identity">
          <div class="cred-username">${esc(c.username || '(no username)')}</div>
          ${c.label ? `<div class="cred-card-label">${esc(c.label)}</div>` : ''}
        </div>
        <div class="cred-card-actions">
          <button class="btn-icon btn-edit" data-id="${esc(c.id)}" title="Edit">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
            </svg>
          </button>
          <button class="btn-icon btn-delete" data-id="${esc(c.id)}" title="Delete">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="cred-password">
        <span class="pw-value" data-id="${esc(c.id)}">••••••••</span>
        <button class="btn-reveal" data-id="${esc(c.id)}">Show</button>
      </div>

      <div class="cred-domains">
        ${(c.domains || []).map(d => `<span class="domain-tag">${esc(d)}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // Attach events after rendering
  list.querySelectorAll('.btn-edit').forEach(b =>
    b.addEventListener('click', () => openModal(b.dataset.id))
  );
  list.querySelectorAll('.btn-delete').forEach(b =>
    b.addEventListener('click', () => deleteCred(b.dataset.id))
  );
  list.querySelectorAll('.btn-reveal').forEach(b =>
    b.addEventListener('click', () => toggleReveal(b))
  );
}

function toggleReveal(btn) {
  const c = creds.find(x => x.id === btn.dataset.id);
  const span = btn.previousElementSibling;
  if (btn.textContent === 'Show') {
    span.textContent = c?.password || '(empty)';
    span.style.letterSpacing = 'normal';
    span.style.fontSize = '13px';
    btn.textContent = 'Hide';
  } else {
    span.textContent = '••••••••';
    span.style.letterSpacing = '2px';
    span.style.fontSize = '15px';
    btn.textContent = 'Show';
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(id = null) {
  editId = id;

  document.getElementById('modal-title').textContent =
    id ? 'Edit credential' : 'New credential';

  if (id) {
    const c = creds.find(x => x.id === id);
    if (!c) return;
    document.getElementById('f-label').value = c.label || '';
    document.getElementById('f-username').value = c.username || '';
    document.getElementById('f-password').value = c.password || '';
    document.getElementById('f-domains').value = (c.domains || []).join('\n');
  } else {
    document.getElementById('f-label').value = '';
    document.getElementById('f-username').value = '';
    document.getElementById('f-password').value = '';
    document.getElementById('f-domains').value = '';
  }

  // Always reset password field visibility
  document.getElementById('f-password').type = 'password';
  document.getElementById('toggle-pw').textContent = 'Show';
  clearError();

  document.getElementById('modal').hidden = false;
  setTimeout(() => document.getElementById('f-username').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').hidden = true;
  editId = null;
}

async function saveCred() {
  const label = document.getElementById('f-label').value.trim();
  const username = document.getElementById('f-username').value.trim();
  const password = document.getElementById('f-password').value;
  const domains = document.getElementById('f-domains').value
    .split('\n')
    .map(d => d.trim())
    .filter(Boolean);

  if (!username && !password) {
    showError('Enter at least a username or password.');
    return;
  }
  if (!domains.length) {
    showError('Enter at least one domain.');
    return;
  }

  if (editId) {
    const idx = creds.findIndex(c => c.id === editId);
    if (idx >= 0) creds[idx] = { ...creds[idx], label, username, password, domains };
  } else {
    creds.push({ id: uid(), label, username, password, domains });
  }

  await store.save();
  render();
  closeModal();
}

async function deleteCred(id) {
  const c = creds.find(x => x.id === id);
  const name = c?.label || c?.username || 'this credential';
  if (!confirm(`Delete "${name}"?`)) return;

  creds = creds.filter(c => c.id !== id);
  await store.save();
  render();
}

// ── Error display ─────────────────────────────────────────────────────────────

function showError(msg) {
  clearError();
  const err = document.createElement('p');
  err.className = 'form-error';
  err.id = 'modal-error';
  err.textContent = msg;
  document.querySelector('.modal-body').appendChild(err);
}

function clearError() {
  document.getElementById('modal-error')?.remove();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  creds = await store.load();
  render();

  // Header + empty state buttons
  document.getElementById('btn-add').addEventListener('click', () => openModal());
  document.getElementById('btn-add-empty').addEventListener('click', () => openModal());

  // Modal controls
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', saveCred);

  // Close modal on backdrop click
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // Password show/hide toggle
  document.getElementById('toggle-pw').addEventListener('click', () => {
    const f = document.getElementById('f-password');
    const btn = document.getElementById('toggle-pw');
    f.type = f.type === 'password' ? 'text' : 'password';
    btn.textContent = f.type === 'password' ? 'Show' : 'Hide';
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const modalOpen = !document.getElementById('modal').hidden;

    if (e.key === 'Escape' && modalOpen) {
      closeModal();
      return;
    }

    // Ctrl/Cmd+S to save while modal is open
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && modalOpen) {
      e.preventDefault();
      saveCred();
    }
  });
});

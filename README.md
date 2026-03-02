# Sandkey

A lightweight Chrome extension that automatically suggests login credentials on local development domains — think Bitwarden or 1Password, but built exclusively for the default users developers create on their local machines.

---

## Why Sandkey?

When working with multiple local environments (`localhost`, `*.test`, `*.home.arpa`, custom hosts), you always end up typing the same default credentials over and over. Sandkey solves this by detecting login forms on those domains and offering one-click autofill, without syncing anything to the cloud or requiring a master password.

| | Other tools | **Sandkey** |
|---|---|---|
| Target | All websites | Local / sandbox environments only |
| Cloud sync | Yes (opt-out at best) | Never — local storage only |
| Account required | Yes | No |
| Master password | Required | Not needed |
| Open source | Partially / no | ✓ fully open source |
| Zero dependencies | No | ✓ pure HTML/CSS/JS |
| Wildcard domain matching | No | ✓ with longest-match priority |
| Framework-compatible autofill | Varies | ✓ React, Vue, Angular |
| Build step required | Often | No |

---

## Features

- **Automatic form detection** — monitors the page for username/password fields, including forms added dynamically by SPAs
- **Wildcard domain matching** — `*.test` matches `foo.test`, `bar.test`, etc.
- **Longest-match priority** — more specific patterns win (`api.test` over `*.test`)
- **Shadow DOM dropdown** — the suggestion UI is fully isolated from page styles; it will never look broken regardless of the host page's CSS
- **Framework-compatible autofill** — fills inputs using the native value setter and dispatches `input`/`change` events, so React, Vue, and Angular forms detect the change correctly
- **Popup autofill** — click the toolbar icon to see matching credentials and fill the form with one click
- **Credential manager** — a full options page to create, edit, and delete credentials with username, password, optional label, and a list of domains
- **No external dependencies** — pure HTML, CSS, and JavaScript; no build step required
- **Local storage only** — credentials are stored in `chrome.storage.local` and never leave your machine

---

## Installation

Sandkey is not published on the Chrome Web Store — it is intended to be loaded as an unpacked extension during development.

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `sandkey/` folder
6. The Sandkey icon will appear in your toolbar

---

## Usage

### Adding credentials

1. Click the Sandkey icon in the toolbar and select **Manage credentials**, or right-click the icon and choose **Options**
2. Click **+ New credential**
3. Fill in the form:
   - **Label** *(optional)* — a human-readable name shown in the dropdown (e.g. "Admin Panel", "Dev Server")
   - **Username** — the username or email to autofill
   - **Password** — the password to autofill
   - **Domains** — one domain pattern per line (see [Domain Matching](#domain-matching) below)
4. Click **Save** or press `Ctrl+S` / `Cmd+S`

### Autofilling a login form

When you navigate to a page whose hostname matches one or more stored credentials:

- Click on any **username or password field** — a dropdown will appear below the field listing all matching credentials, sorted from most specific to least specific
- Click a credential to fill both fields instantly
- Press `Escape` to dismiss the dropdown without filling

Alternatively, click the **Sandkey toolbar icon** to see matching credentials for the current tab and use the **Fill** button.

---

## Domain Matching

Domain patterns are matched against `window.location.hostname` (port numbers are ignored).

| Pattern | Matches | Does not match |
|---|---|---|
| `localhost` | `localhost`, `localhost:3000`, `localhost:8080` | `my.localhost` |
| `api.test` | `api.test` | `sub.api.test` |
| `*.test` | `app.test`, `api.test`, `a.b.test`, `a.b.c.test` | `test` |
| `*.api.test` | `v1.api.test`, `v2.api.test`, `a.b.api.test` | `api.test` |
| `*.home.arpa` | `device.home.arpa`, `deep.device.home.arpa` | `home.arpa` |
| `*.local` | `myserver.local`, `sub.myserver.local` | `local` |

**Wildcard rules:**
- A wildcard `*` matches **one or more DNS labels** — `*.test` covers any subdomain depth
- Exact matches always beat wildcard matches
- Among wildcards, the longest suffix wins: `*.api.test` scores higher than `*.test` for `v1.api.test`

**Example:** you are on `v1.api.test` and have two credentials:

```
Credential A  →  domains: [*.api.test]
Credential B  →  domains: [*.test]
```

Both match, but **Credential A appears first** because `*.api.test` is more specific than `*.test`. On `app.test`, only Credential B is shown.

---

## Project Structure

```
sandkey/
├── manifest.json     — Extension manifest (Manifest V3)
├── content.js        — Injected into every page; handles form detection,
│                       domain matching, Shadow DOM dropdown, and autofill
├── popup.html        — Toolbar popup markup
├── popup.js          — Popup logic: reads current tab URL, matches credentials,
│                       sends autofill message to content script
├── popup.css         — Popup styles
├── options.html      — Full-page credential manager markup
├── options.js        — CRUD logic for credentials (add, edit, delete, reveal)
└── options.css       — Options page styles
```

No background service worker is needed — the content script communicates directly with the popup via `chrome.runtime.onMessage`.

---

## Data Storage

All credentials are stored locally using the Chrome Extension `chrome.storage.local` API under the key `credentials`. The data structure is:

```json
[
  {
    "id": "uuid-v4",
    "label": "Optional label",
    "username": "admin",
    "password": "secret",
    "domains": ["localhost", "*.test", "*.home.arpa"]
  }
]
```

Data is never transmitted to any remote server.

---

## Keyboard Shortcuts

| Context | Shortcut | Action |
|---|---|---|
| Dropdown visible | `Escape` | Close dropdown |
| Dropdown visible | `Enter` / `Space` on item | Autofill and close |
| Options modal open | `Escape` | Close modal |
| Options modal open | `Ctrl+S` / `Cmd+S` | Save credential |

---

## Limitations & Known Behaviours

- **Single-level wildcards only** — `*.test` does not match `a.b.test`. This is intentional and mirrors DNS wildcard semantics.
- **First password field** — when autofilling from the popup, Sandkey targets the first `input[type=password]` found on the page.
- **Chrome-only** — the extension uses Chrome-specific APIs and Manifest V3 format. It has not been tested on Firefox or other browsers.
- **No master password** — credentials are stored in plain text in `chrome.storage.local`. This is by design; Sandkey is intended for non-sensitive default development credentials, not production secrets.
- **Special pages** — Sandkey does not run on `chrome://`, `chrome-extension://`, or `file://` pages (Chrome restriction for content scripts).

---

## Contributing

This is a developer convenience tool. Feel free to fork it and adapt it to your workflow. Pull requests for bug fixes and improvements are welcome.

---

## License

MIT

---

## Credits

Extension icon — [Sandstone Wave](https://www.thiings.co/things/sandstone-wave) by [Thiings](https://www.thiings.co)

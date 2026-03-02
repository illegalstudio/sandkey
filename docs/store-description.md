# Chrome Web Store — Sandkey

## Short description (max 132 chars)

Autofill default credentials on local and sandbox environments. Open source, local-first, zero cloud.

---

## Full description

Sandkey is the credential manager built for developers, not end users.

When you spin up a new local project — Laravel, Rails, Django, a Docker stack — you always end up typing the same default credentials over and over: `admin / admin`, `root / secret`, `user@example.com / password`. Sandkey remembers them for you and fills them in with one click.

**Local-first, always.**
Your credentials never leave your machine. There is no account, no server, no sync, no analytics. Everything is stored in Chrome's local storage and stays there. Sandkey cannot phone home because it has no home to phone.

**Open source.**
Sandkey is fully open source and available on GitHub: https://github.com/illegalstudio/sandkey
Read the code, audit it, fork it, contribute to it.

**Built for sandbox domains.**
Sandkey is designed around the domains developers actually use: `localhost`, `*.test`, `*.local`, `*.home.arpa`, custom Docker hostnames. It supports wildcard patterns at any depth and port-aware matching — `localhost:3000` can have different credentials than `localhost:8080`.

**Longest-match priority.**
Configure `*.test` as a catch-all and `*.api.test` for a specific project. Sandkey always picks the most specific rule — no surprises.

**Autofill that works everywhere.**
The autofill dropdown is injected via Shadow DOM, so it never clashes with the page's own styles. It works with React, Vue, Angular, and plain HTML forms — including dynamically rendered ones.

**No bloat.**
No background service worker. No remote calls. No dependencies. The entire extension is a handful of vanilla JavaScript files.

---

## Key features

- Store multiple credentials, each with a label, username, password, and list of domain patterns
- Wildcard domains: `*.test` matches `app.test`, `api.test`, `a.b.c.test`
- Port-aware matching: `localhost:3000` takes priority over `localhost`
- Longest-match rule: more specific patterns always win
- Autofill dropdown on any login form, injected via Shadow DOM
- One-click fill from the toolbar popup
- Full credentials manager in the Options page (add, edit, delete, show/hide password)
- 100% local storage — no account, no cloud, no telemetry
- Open source (MIT)

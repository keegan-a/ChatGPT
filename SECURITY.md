# Security Notes for Budget Builder 95

## Contact
- **Email:** security@budgetbuilder95.com
- **PGP Key:** (optional) publish your key fingerprint here if you use encrypted reports.

We aim to acknowledge new reports within two business days. Please avoid public disclosure until we provide a fix or mutually agree on a release timeline.

---

## Data handling
- **OpenAI API keys** are encrypted client-side using AES-GCM before storage. When the Capacitor runtime is present, the encrypted blob is mirrored into native secure storage via `@capacitor/preferences`.
- **Budget data** (income, categories, journal entries) lives entirely in the user’s browser storage. No analytics or telemetry is collected.
- **Uploaded statements** stay in memory; PDFs are parsed with pdf.js directly in the browser. Nothing is transmitted except the excerpts explicitly sent to the OpenAI API.

---

## Content Security Policy
The production CSP enforced by Electron and the hosted site is:
```
default-src 'self';
script-src 'self';
style-src 'self' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
connect-src 'self' https://api.openai.com;
img-src 'self' data: blob:;
media-src 'self';
worker-src 'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
```

If you extend the app to use additional origins, update both `electron/main.js` and `index.html` accordingly.

---

## Service worker & offline caching
- Cached assets include `index.html`, `app.js`, `styles.css`, the manifest, pdf.js, and the offline fallback screen.
- Navigation failures respond with `offline.html` so the desktop shells never display a blank page when offline.
- Bump the `CACHE_NAME` constant inside `sw.js` whenever you make changes to offline assets.

---

## Known hardening tasks
- Supply your own code-signing certificates before distributing desktop installers.
- Configure HTTP response headers on the hosting provider (e.g., `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`).
- Replace the placeholder security contact above with your production alias.

Thank you for helping us keep the retro budgeting desktop secure for everyone.

# Mitramite — Turnos disponibles

- Chrome Web Store: https://chromewebstore.google.com/detail/poajbmnppibplfelmnbbhifaelmhpcio?utm_source=item-share-cb
- Firefox Add-ons: https://addons.mozilla.org/es-ES/firefox/addon/mitramite-turnos/

A browser extension (Manifest V3) for Chrome and Firefox that intercepts appointment-availability responses from the Argentine government portal [mitramite.renaper.gob.ar](https://mitramite.renaper.gob.ar) and surfaces them in a clean floating overlay — no DevTools, no dropdown hunting.

---

## How it works

The portal searches for available slots by calling `busqueda.php` via XHR or `fetch`. The extension hooks into that request cycle invisibly and, when a response arrives, parses the JSON and injects a panel directly into the page showing dates, times, offices (_sedes_), procedure types (_trámites_), and remaining quota (_cupos_).

Three compiled scripts serve distinct roles:

| Script           | World                | Role                                                                                                   |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| `interceptor.js` | `MAIN` (page JS)     | Monkey-patches `XMLHttpRequest` and `fetch`; fires a `CustomEvent` with the raw response body          |
| `content.js`     | Isolated (extension) | Listens for those events, parses the payload, mounts a React 18 overlay inside a **closed Shadow DOM** |
| `popup/popup.js` | Extension popup      | Sends a `TOGGLE_OVERLAY` message to the active tab to show/hide the panel                              |

The interceptor is read-only — it never modifies requests or responses.

---

## Features

- **Live updates** — each `busqueda.php` response replaces the previous panel content automatically.
- **Copy JSON** — one-click copies the raw response body to the clipboard with a success toast.
- **Error resilience** — defensive parser handles multiple JSON shapes (`turnos`, `horarios`, `resultados` keys; `data` wrapper; `DD/MM/YYYY` and ISO 8601 dates); falls back to a raw `<pre>` view if the shape is unrecognised.
- **Style isolation** — Shadow DOM prevents host-page CSS from leaking into the overlay.
- **Minimal permissions** — only `activeTab`, `clipboardWrite`, and the host permission for `*://mitramite.renaper.gob.ar/*`.
- **Zero external calls** — all logic runs locally; no analytics, no CDN dependencies.

---

## Requirements

- Node.js 18+
- [pnpm](https://pnpm.io/) 9+
- Chrome 111+ (requires `world: "MAIN"` content-script support)
- Firefox 128+ (for Firefox builds)

---

## Getting started

```bash
# Install dependencies
pnpm install

# One-shot production build for Chrome → dist/chrome/
pnpm build:chrome

# One-shot production build for Firefox → dist/firefox/
pnpm build:firefox

# Watch mode — rebuilds dist/chrome/ on every src/ change
pnpm dev
```

### Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `dist/chrome/` folder.
4. After any rebuild, click the **↺** reload icon on the extension card.

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select any file inside `dist/firefox/`.
3. After any rebuild, click **Reload** on the extension entry.

---

## Scripts

| Script                 | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| `pnpm build`           | Alias for `build:chrome` — outputs `dist/chrome/`              |
| `pnpm build:chrome`    | Production build for Chrome — outputs `dist/chrome/`           |
| `pnpm build:firefox`   | Production build for Firefox — outputs `dist/firefox/`         |
| `pnpm dev`             | Watch-mode build (Chrome)                                      |
| `pnpm test`            | Unit tests in watch mode (Vitest)                              |
| `pnpm test:run`        | Unit tests, single pass (CI)                                   |
| `pnpm coverage`        | Tests + V8 coverage report (`coverage/lcov-report/`)           |
| `pnpm lint`            | ESLint with zero-warnings policy                               |
| `pnpm lint:firefox`    | `web-ext lint` against `dist/firefox/`                         |
| `pnpm package:firefox` | Package `dist/firefox/` into a distributable zip via `web-ext` |
| `pnpm typecheck`       | TypeScript type-check without emitting JS                      |

> **Note:** The build runs three sequential Vite IIFE bundles (one per entry point) via [`build.mjs`](build.mjs) to work around Rollup's limitation with multiple IIFE inputs. The `TARGET` env var selects the output directory (`chrome` or `firefox`); the Firefox build additionally patches the manifest with `browser_specific_settings.gecko`.

---

## Project structure

```
src/
├── interceptor/       # MAIN-world XHR/fetch interceptor
├── content/
│   ├── index.tsx      # Shadow DOM host + React mount
│   ├── parser.ts      # Defensive JSON → ParseResult discriminated union
│   └── overlay/       # Panel, SlotList, CopyButton, ErrorBanner components
├── popup/             # Toolbar popup
└── types/             # Shared TypeScript types (AppointmentSlot, ParseResult, …)
public/
├── manifest.json
└── popup/popup.html
tests/unit/            # Vitest + Testing Library tests
specs/                 # Feature specs, research notes, implementation plans
.github/workflows/
├── ci.yml             # Tests & lint on every pull request
├── build.yml          # Builds both targets and uploads artifacts on push to master
└── release.yml        # Builds, packages, and publishes to stores on version tag (v*.*.*)
```

---

## CI/CD

Three GitHub Actions workflows automate the quality and release pipeline:

| Workflow      | Trigger                 | What it does                                                     |
| ------------- | ----------------------- | ---------------------------------------------------------------- |
| `ci.yml`      | Pull request → `master` | Runs unit tests and ESLint; blocks merge on failure              |
| `build.yml`   | Push to `master`        | Builds Chrome and Firefox artifacts and uploads them for 90 days |
| `release.yml` | Push of a `v*.*.*` tag  | Builds, packages, and publishes the Firefox extension to AMO     |

To release a new version, create and push a semver tag from the `master` branch:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The release workflow validates the tag, patches `manifest.json` with the version number, and publishes to the Firefox Add-ons Store using the `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` repository secrets.

---

## Packaging for distribution

**Chrome:**

```bash
pnpm build:chrome
cd dist/chrome && zip -r ../../mitramite-extension.zip .
```

Upload the zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

**Firefox:**

```bash
pnpm build:firefox
pnpm package:firefox   # produces artifacts/firefox/*.zip
```

Upload the zip to [addons.mozilla.org](https://addons.mozilla.org/developers/).

---

## Tech stack

- **TypeScript 5.5** (strict, ESNext modules)
- **React 18** + Shadow DOM
- **Vite 5** + `@vitejs/plugin-react`
- **Vitest 2** + Testing Library
- **ESLint 8** + Prettier 3
- **web-ext 10** (Firefox packaging & linting)
- **pnpm 9**

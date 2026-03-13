# Mitramite — Turnos disponibles

A Chrome extension (Manifest V3) that intercepts appointment-availability responses from the Argentine government portal [mitramite.renaper.gob.ar](https://mitramite.renaper.gob.ar) and surfaces them in a clean floating overlay — no DevTools, no dropdown hunting.

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

---

## Getting started

```bash
# Install dependencies
pnpm install

# One-shot production build → dist/
pnpm build

# Watch mode (rebuilds dist/ on every src/ change)
pnpm dev
```

### Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `dist/` folder.
4. After any rebuild, click the **↺** reload icon on the extension card.

---

## Scripts

| Script           | Description                                          |
| ---------------- | ---------------------------------------------------- |
| `pnpm build`     | Production build — outputs `dist/`                   |
| `pnpm dev`       | Watch-mode build                                     |
| `pnpm test`      | Unit tests in watch mode (Vitest)                    |
| `pnpm test:run`  | Unit tests, single pass (CI)                         |
| `pnpm coverage`  | Tests + V8 coverage report (`coverage/lcov-report/`) |
| `pnpm lint`      | ESLint with zero-warnings policy                     |
| `pnpm typecheck` | TypeScript type-check without emitting JS            |

> **Note:** The build runs three sequential Vite IIFE bundles (one per entry point) via [`build.mjs`](build.mjs) to work around Rollup's limitation with multiple IIFE inputs.

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
specs/                 # Feature spec, research notes, implementation plan
```

---

## Packaging for distribution

```bash
pnpm build
zip -r mitramite-extension.zip dist/
```

Upload the zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Tech stack

- **TypeScript 5.5** (strict, ESNext modules)
- **React 18** + Shadow DOM
- **Vite 5** + `@vitejs/plugin-react`
- **Vitest 2** + Testing Library
- **ESLint 8** + Prettier 3
- **pnpm 9**

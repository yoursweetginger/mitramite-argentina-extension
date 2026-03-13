# Quickstart: Chrome Extension — Appointment Slot Overlay

## Prerequisites

| Tool    | Version | Notes                                               |
| ------- | ------- | --------------------------------------------------- |
| Node.js | 20+     | [nodejs.org](https://nodejs.org)                    |
| pnpm    | 9+      | `npm install -g pnpm`                               |
| Chrome  | 111+    | Required for `world: "MAIN"` content script support |

---

## 1. Install Dependencies

```bash
pnpm install
```

---

## 2. Development Build (watch mode)

```bash
pnpm dev
```

- Vite watches `src/` and rebuilds on change
- Output is written to `dist/`
- The extension must be reloaded manually in Chrome after each build (see step 3)

---

## 3. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder (repository root → `dist`)
5. The extension icon appears in the toolbar

After any code change:

- Run `pnpm build` (or let `pnpm dev` rebuild)
- On `chrome://extensions`, click the **↺ reload** icon next to the extension
- Refresh the target tab

---

## 4. Try It Out

1. Navigate to `https://mitramite.renaper.gob.ar/`
2. Fill in the search form (procedure, province, etc.) and submit
3. The extension intercepts the `busqueda.php` response and displays the overlay panel
4. Click **✕** to dismiss; click the toolbar icon → **Toggle Panel** to re-open
5. Click **Copiar JSON** to copy the raw response to the clipboard

---

## 5. Run Tests

```bash
pnpm test
```

- Runs Vitest in watch mode (`pnpm test --run` for CI / single pass)
- Coverage report: `pnpm test --coverage`
- Target: ≥80 % line coverage on `src/content/parser.ts` and `src/content/overlay/Panel.tsx`

---

## 6. Production Build

```bash
pnpm build
```

Output in `dist/` is the unpacked extension. To distribute it, zip the contents:

```bash
zip -r mitramite-extension.zip dist/
```

Then upload the zip to the Chrome Web Store Developer Dashboard.

---

## 7. Project Scripts (package.json)

| Script           | Command                       | Purpose                       |
| ---------------- | ----------------------------- | ----------------------------- |
| `pnpm dev`       | `vite build --watch`          | Watch mode development build  |
| `pnpm build`     | `vite build`                  | One-shot production build     |
| `pnpm test`      | `vitest`                      | Run unit tests (watch)        |
| `pnpm test:run`  | `vitest run`                  | Run unit tests (CI, no watch) |
| `pnpm coverage`  | `vitest run --coverage`       | Test with coverage report     |
| `pnpm lint`      | `eslint src --max-warnings 0` | Lint all TypeScript source    |
| `pnpm typecheck` | `tsc --noEmit`                | Type-check without emitting   |

---

## 8. Key File Locations

| File                            | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `manifest.json`                 | Chrome extension manifest V3        |
| `src/interceptor/index.ts`      | MAIN-world XHR/fetch patcher        |
| `src/content/index.ts`          | Shadow DOM mount + message listener |
| `src/content/parser.ts`         | `busqueda.php` response parser      |
| `src/content/overlay/Panel.tsx` | React overlay root component        |
| `src/popup/popup.ts`            | Toggle message sender               |
| `src/types/busqueda.ts`         | Shared TypeScript types             |
| `vite.config.ts`                | Multi-entry build config            |
| `tests/unit/parser.test.ts`     | Parser unit tests                   |
| `tests/unit/Panel.test.tsx`     | Overlay state transition tests      |

---

## 9. Architecture Overview

```
mitramite.renaper.gob.ar page
│
├── [MAIN world] src/interceptor/index.ts
│     Monkey-patches window.fetch + window.XMLHttpRequest
│     → Dispatches CustomEvent('mitramite:busqueda', { detail: { body } })
│
└── [Isolated world] src/content/index.ts
      Listens for 'mitramite:busqueda' → calls parser.parse(body)
      Mounts React Panel inside Shadow DOM on document.body
      Handles chrome.runtime.onMessage { type: 'TOGGLE_OVERLAY' }

Chrome toolbar icon
└── popup.html / popup.ts
      Sends chrome.tabs.sendMessage { type: 'TOGGLE_OVERLAY' }
      (no background/service worker required)
```

---

## 10. Manifest Permissions Summary

```json
{
  "permissions": ["activeTab", "clipboardWrite"],
  "host_permissions": ["*://mitramite.renaper.gob.ar/*"]
}
```

No other permissions are requested (SC-006, FR-009).

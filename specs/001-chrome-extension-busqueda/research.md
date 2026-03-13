# Phase 0 Research: Chrome Extension — Appointment Slot Overlay

**Date**: 2026-03-13  
**Feature Branch**: `001-chrome-extension-busqueda`

---

## 1. `busqueda.php` Response Schema

### Decision

Treat the schema as **unknown at design time**; use a defensive parser that accepts
`unknown` JSON and falls back to raw-text display if parsing fails or fields are absent.

### Rationale

No public documentation, open-source reverse-engineering, or forum posts revealing
the exact shape of the response were found. The endpoint is internal to the Argentine
RENAPER appointment system and not publicly documented.

### Inferred Schema (best-effort, to be confirmed at integration time)

Based on Argentine government system naming conventions and the domain (appointment
availability search), the response is expected to be **pure JSON** with the following
probable shape:

```jsonc
{
  // Wrapper
  "success": true, // or false on server-side failure
  "message": "...", // status message in Spanish

  // Primary payload (present when success === true)
  "turnos": [
    {
      "id": "string|number",
      "fecha": "DD/MM/YYYY", // Argentine locale format likely; could be YYYY-MM-DD
      "hora": "HH:MM",
      "sede": "CABA - Centro", // Office/location display name
      "idSede": "string|number",
      "tramite": "DNI", // Procedure type
      "cupos": 3, // Remaining slot count
      "disponible": true,
    },
  ],

  // Error details (present when success === false)
  "error": {
    "codigo": "NO_TURNOS",
    "descripcion": "No hay turnos disponibles para los criterios buscados.",
  },
}
```

**Field-name alternatives to handle defensively**:

- `turnos` may also appear as `horarios`, `resultados`, or `disponibilidad`
- `sede` may be an object `{ id, nombre, direccion }` rather than a plain string
- `fecha` may be ISO 8601 (`YYYY-MM-DD`) or localised (`DD/MM/YYYY`) — parse both
- Top-level may be a flat array of slots rather than a `{ turnos: [...] }` wrapper

### Resolution Strategy

The parser (`src/content/parser.ts`) will apply the following heuristics in order:

1. If response is a JSON array → treat each element as an `AppointmentSlot`
2. If response is a JSON object with a `turnos` / `horarios` / `resultados` key → extract the array
3. If any of the above succeed → display structured slots in the Panel
4. Otherwise (parse failure or non-array content) → display raw `<pre>` text (FR-002 fallback)

### Alternatives Considered

- Hardcoding specific field names → rejected; fragile against schema changes
- Using `zod` for runtime validation → rejected; adds bundle weight; defensive optional
  chaining achieves the same effect for this scope

---

## 2. XHR/Fetch Interception in MV3

### Decision

Use a **`world: "MAIN"` content script** (`src/interceptor/index.ts`, run at
`document_start`) that monkey-patches `window.XMLHttpRequest` and `window.fetch`.
Intercepted response bodies are relayed to the isolated-world content script via
`window.dispatchEvent(new CustomEvent('mitramite:busqueda', { detail: '...' }))`.

### Rationale

- Isolated-world content scripts cannot access the page's `window.XMLHttpRequest`
  or `window.fetch` globals — they share the DOM but not the JS context.
- `world: "MAIN"` (supported since Chrome 111) allows a content script to execute
  in the page's global JS context, where it can patch network globals directly.
- **CustomEvent vs postMessage**: `CustomEvent` is preferred here because both
  scripts share the same `window` object. No cross-origin boundary exists.
  `postMessage` would add origin-validation boilerplate for no security gain in
  this same-origin, same-window scenario. The `detail` field is a plain string
  (the raw response body), not a live JS object, so injection risk is minimal.

### Implementation Pattern

**MAIN-world script (`src/interceptor/index.ts`, runs at `document_start`)**:

```ts
// Override XHR
const _open = XMLHttpRequest.prototype.open;
const _send = XMLHttpRequest.prototype.send;
const tracked = new WeakMap<XMLHttpRequest, string>();

XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  tracked.set(this, String(url));
  return _open.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.send = function (...args) {
  const url = tracked.get(this) ?? "";
  if (url.includes("busqueda.php")) {
    this.addEventListener("load", () => {
      window.dispatchEvent(
        new CustomEvent("mitramite:busqueda", { detail: this.responseText }),
      );
    });
  }
  return _send.apply(this, args);
};

// Override fetch
const _fetch = window.fetch;
window.fetch = async function (...args) {
  const url = String(
    typeof args[0] === "string" ? args[0] : ((args[0] as Request).url ?? ""),
  );
  const response = await _fetch.apply(this, args);
  if (url.includes("busqueda.php")) {
    const body = await response.clone().text();
    window.dispatchEvent(
      new CustomEvent("mitramite:busqueda", { detail: body }),
    );
  }
  return response; // original response untouched (FR-008)
};
```

**Isolated-world listener (`src/content/index.ts`)**:

```ts
window.addEventListener("mitramite:busqueda", (e) => {
  const raw = (e as CustomEvent<string>).detail;
  updateOverlay(raw); // calls setRawText / setParsedData on Panel state
});
```

### Security Considerations

- The `detail` payload is a string extracted from the page's own XHR response.
  The extension only reads it; it does not eval, execute, or write it back.
- The `CustomEvent` listener validates the event is fired on `window` (same document);
  cross-frame injection is not possible over a named CustomEvent from a different frame.
- No user-supplied input is ever eval'd or inserted as raw HTML (FR-007).

### Alternatives Considered

- `declarativeNetRequest` for interception → rejected; DNR can block/redirect but
  **cannot** capture response bodies (it operates at the network rules level only)
- Script injection via `<script>` tag → rejected; `world: "MAIN"` achieves the same
  goal more cleanly without DOM pollution
- Background service worker + `webRequest` API → rejected; `webRequest` (full) is not
  available in MV3 from service workers; also ruled out by architecture constraint

---

## 3. Shadow DOM + React Injection

### Decision

The isolated-world content script creates a `<div id="mitramite-ext-root">` host element,
attaches a **closed** Shadow DOM, injects CSS via a `<style>` element (using Vite's
`?inline` CSS import), and mounts a React 18 root inside the shadow root.

### Rationale

- **Closed Shadow DOM** (`mode: 'closed'`) prevents the host page's scripts from
  reaching into `shadowRoot.host.shadowRoot` and mutating or reading overlay state.
  `mode: 'open'` is acceptable too and slightly simpler; `'closed'` chosen for defence
  in depth since the host page is third-party.
- **CSS isolation**: Vite's `?inline` import modifier (`import panelCss from
'./overlay/panel.css?inline'`) imports the CSS file as a plain string. This string
  is injected into a `<style>` tag inside the shadow root, fully isolating overlay
  styles from the host page.

### Implementation Sketch

```ts
// src/content/index.ts
import panelCss from './overlay/panel.css?inline';
import { createRoot } from 'react-dom/client';
import { Panel } from './overlay/Panel';

const host = document.createElement('div');
host.id = 'mitramite-ext-root';
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: 'closed' });

const style = document.createElement('style');
style.textContent = panelCss;
shadow.appendChild(style);

const mountPoint = document.createElement('div');
shadow.appendChild(mountPoint);
createRoot(mountPoint).render(<Panel />);
```

### Alternatives Considered

- Injecting a `<link rel="stylesheet">` pointing to
  `chrome.runtime.getURL('panel.css')` → requires declaring the CSS as a
  `web_accessible_resource`; more manifest entries; slightly less clean
- CSS-in-JS (styled-components / Emotion) → adds ~25 KB to bundle; rejected per
  minimal-dependency principle

---

## 4. Vite Multi-Entry Build Configuration

### Decision

Use **manual `build.rollupOptions.input`** with `output.format: 'iife'` and separate
entry points for `interceptor.js`, `content.js`, and `popup.js`. No `@crxjs/vite-plugin`.

### Rationale

- `@crxjs/vite-plugin` normally assumes a service-worker background script for HMR;
  the no-background constraint makes manual config simpler and more explicit.
- `format: 'iife'` is required for content scripts — Chrome cannot load ES module
  content scripts via `"js": ["content.js"]` in the manifest (it only works with
  `"type": "module"` in the script tag, which manifest content scripts don't support).
- Vite's `?inline` CSS import for shadow root styles avoids the need to declare
  extracted CSS as `web_accessible_resources`.

### `vite.config.ts` (definitive)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        interceptor: resolve(__dirname, "src/interceptor/index.ts"),
        content: resolve(__dirname, "src/content/index.tsx"),
        popup: resolve(__dirname, "src/popup/popup.ts"),
      },
      output: {
        format: "iife",
        entryFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        // IIFE format prevents Rollup from emitting shared chunks automatically
      },
    },
  },
});
```

> **Note**: `inlineDynamicImports: true` is incompatible with multiple input entries
> in Rollup. It is not needed here because content scripts use static imports only.
> IIFE format naturally bundles everything into a single file per entry.

### Build Outputs

```text
dist/
├── interceptor.js    # MAIN-world XHR/fetch patcher
├── content.js        # React overlay (includes React bundled in)
├── popup.js          # Popup toggle script
├── manifest.json     # Copied from public/
└── icons/
    └── icon-128.png
```

The popup HTML (`popup.html`) references `popup.js` and is copied from `public/popup/popup.html`
(static asset). Vite copies `public/` contents to `dist/` automatically.

### Alternatives Considered

- Single entry point that dynamically imports sub-modules → rejected; Chrome does not
  support dynamic `import()` in content scripts without additional workarounds
- `@crxjs/vite-plugin` → rejected; adds service-worker assumptions and opinionated
  manifest transform that conflicts with zero-background-script constraint

---

## 5. Toolbar Icon Toggle (Popup → Content Script, No Service Worker)

### Decision

Configure a **Manifest V3 action popup** (`popup/popup.html`) that uses
`chrome.tabs.sendMessage` to dispatch `{ type: 'TOGGLE_OVERLAY' }` to the active tab's
isolated-world content script. No background script or service worker is needed.

### Rationale

- In MV3, if `action.default_popup` is set, clicking the toolbar icon shows the popup
  (not `chrome.action.onClicked`). `chrome.action.onClicked` only fires when there is
  **no** popup configured — and that event would require a service worker to receive it.
- The popup HTML is a tiny, self-contained page that can call `chrome.tabs.query` and
  `chrome.tabs.sendMessage` directly without any background intermediary.
- The content script registers `chrome.runtime.onMessage.addListener` and handles
  `TOGGLE_OVERLAY` to show or hide the panel.

### Implementation Sketch

**`src/popup/popup.ts`**:

```ts
document.getElementById("toggle-btn")!.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
    window.close();
  }
});
```

**`src/content/index.ts`** (add to existing listener):

```ts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TOGGLE_OVERLAY") {
    setVisible((v) => !v);
  }
});
```

### Alternatives Considered

- Service worker `chrome.action.onClicked` + `chrome.tabs.sendMessage` → works but
  contradicts the no-service-worker architecture; rejected
- `chrome.storage.local` for shared visibility state → unnecessary complexity; rejected

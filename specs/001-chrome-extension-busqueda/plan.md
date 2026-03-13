# Implementation Plan: Chrome Extension — Appointment Slot Overlay for mitramite.renaper.gob.ar

**Branch**: `001-chrome-extension-busqueda` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-chrome-extension-busqueda/spec.md`

## Summary

Build a Manifest V3 Chrome extension that silently intercepts `busqueda.php` responses on
`mitramite.renaper.gob.ar`, parses appointment-availability data, and renders it in a
dismissible Shadow DOM overlay. A dual-script architecture splits interception (MAIN world)
from overlay rendering (isolated world + React), connected via a named `CustomEvent` on
`window`. An action popup provides toolbar toggle with zero service-worker dependency.

## Technical Context

**Language/Version**: TypeScript 5.x; Node.js 20+ (build only)  
**Primary Dependencies**: Vite 5.x, `@vitejs/plugin-react`, React 18.x, Vitest 3.x  
**Storage**: N/A — all state is ephemeral in-page; no `chrome.storage` used  
**Testing**: Vitest (jsdom environment); `@testing-library/react` for component tests  
**Target Platform**: Chrome 111+ desktop (Manifest V3; `world: "MAIN"` supported since Chrome 111)  
**Project Type**: Browser extension (Chrome MV3, no backend)  
**Performance Goals**: Overlay visible ≤500 ms after `busqueda.php` response; content-script injection ≤150 ms  
**Constraints**: Unpacked extension ≤500 KB; zero runtime CDN dependencies; no service worker; no background script  
**Scale/Scope**: Single target origin, two content-script entry points, one popup, ~5 React components

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Per `.specify/memory/constitution.md` v1.0.0, verify the following before proceeding:

- [x] **Code Quality**: Each module has a single responsibility: `interceptor/index.ts`
      patches network; `content/parser.ts` parses; `content/overlay/Panel.tsx` renders.
      Cyclomatic complexity per function kept ≤10 by design. Zero unnecessary deps.
      ESLint + Prettier enforced via `pnpm lint`. No dead code in bundled output.
- [x] **Testing Standards**: TDD approach — unit tests for parser and overlay state transitions
      written first. Vitest coverage ≥80% on `src/content/parser.ts` and `Panel.tsx`.
      Tests are deterministic; jsdom environment reproducible.
- [x] **UX Consistency**: No VS Code commands (Chrome extension, not VS Code extension).
      **DEVIATION** documented below — `mitramite.<verb>` namespace does not apply;
      Chrome extension uses `chrome.runtime.sendMessage` message types instead
      (`TOGGLE_OVERLAY`, `BUSQUEDA_RESPONSE`). Error messages are user-facing Spanish
      plain text; no stack traces exposed (FR-007).
- [x] **Performance**: Content-script injection is passive (no heavy startup work);
      Shadow DOM mount is synchronous but lightweight (<1 ms). Vite tree-shaking keeps
      bundle minimal. Estimated bundle: React ~45 KB gzipped, overlay CSS <5 KB.
      Total unpacked target ≤500 KB (SC-004). 150 ms injection budget feasible.

> If any gate **cannot** be met, document the violation in the Complexity
> Tracking table below with justification before proceeding.

### Post-Phase-1 Constitution Re-check

All gates remain green after Phase 1 design. Key confirmations:

- **Code Quality**: Module boundaries held — 6 small single-responsibility files in
  `src/content/overlay/`; parser separated from UI; types isolated in `src/types/`.
- **Testing**: `parser.ts` is a pure function — 100 % unit-testable without DOM.
  `Panel.tsx` state transitions covered by `@testing-library/react` + Vitest jsdom.
  Coverage target ≥80 % remains achievable.
- **Bundle size**: React 18 minified+gzipped ≈45 KB. CSS `?inline` avoids a separate
  network request. Total estimated dist size ≈200–250 KB unpacked; well within 500 KB.
- **Deviation confirmed**: `mitramite.<verb>` command namespace applies to VS Code
  extensions; Chrome extension message types (`TOGGLE_OVERLAY`) follow the same
  intent (namespaced, verb-prefixed) and are documented in
  `contracts/chrome-messages.md`.

## Project Structure

### Documentation (this feature)

```text
specs/001-chrome-extension-busqueda/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── dom-events.md    # Custom DOM event contracts (interceptor → overlay)
│   └── chrome-messages.md  # chrome.runtime.Message contracts (popup → content)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── interceptor/
│   └── index.ts              # MAIN-world entry: monkey-patches window.fetch + window.XMLHttpRequest
│                             # Dispatches CustomEvent('mitramite:busqueda') on window
├── content/
│   ├── index.ts              # ISOLATED-world entry: mounts Shadow DOM overlay, wires events
│   ├── parser.ts             # Parses raw response text → AppointmentSlot[] (or raw fallback)
│   └── overlay/
│       ├── Panel.tsx         # React overlay root component
│       ├── SlotList.tsx      # Renders list of AppointmentSlot rows
│       ├── CopyButton.tsx    # "Copiar JSON" button with clipboard + toast
│       ├── ErrorBanner.tsx   # User-facing error display (no stack traces)
│       └── panel.css         # Shadow-root-scoped styles (injected by content/index.ts)
├── popup/
│   ├── popup.html            # Action popup HTML (no React; plain HTML)
│   └── popup.ts              # Sends TOGGLE_OVERLAY to active tab via chrome.tabs.sendMessage
└── types/
    └── busqueda.ts           # Shared TypeScript types (BusquedaResponse, AppointmentSlot, etc.)

public/
└── icons/
    └── icon-128.png          # Extension icon

manifest.json                 # Manifest V3 (two content scripts, action popup, no background)

tests/
└── unit/
    ├── parser.test.ts        # Tests for parser.ts (JSON + fallback paths)
    └── Panel.test.tsx        # Tests for overlay Panel state transitions
```

**Structure Decision**: Single project (Option 1) — no backend, no separate packages.
All source under `src/`; built output to `dist/`. Two Rollup entry points for content
scripts plus one for the popup are handled via `vite.config.ts` with `build.rollupOptions.input`.

## Complexity Tracking

| Violation                                         | Why Needed                                                                                                                                                               | Simpler Alternative Rejected Because                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two content scripts (MAIN world + isolated world) | MV3 requires `world: "MAIN"` to patch `window.fetch`/`window.XMLHttpRequest` at the page JS level; isolated-world scripts cannot reliably intercept page-level XHR/fetch | A single isolated-world script cannot monkey-patch the page's network globals — the page context is separate from the extension context in MV3               |
| `mitramite.<verb>` naming deviation               | This is a Chrome extension, not a VS Code extension; no VS Code commands exist                                                                                           | Chrome extension messaging uses typed message objects instead of named VS Code commands; the naming convention is preserved in Chrome message `type` strings |

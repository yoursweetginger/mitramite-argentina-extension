# Tasks: Chrome Extension — Appointment Slot Overlay for mitramite.renaper.gob.ar

**Input**: Design documents from `/specs/001-chrome-extension-busqueda/`  
**Branch**: `001-chrome-extension-busqueda`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

---

## Phase 1: Setup

**Purpose**: Initialize the project skeleton — package manager, TypeScript, Vite multi-entry build, Vitest, ESLint, Manifest V3 shell, and static assets. Nothing in later phases can compile without this.

- [x] T001 Initialize pnpm project: create `package.json` with scripts (dev, build, test, test:run, coverage, lint, typecheck) and install all dependencies (`vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `typescript`, `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `eslint`, `prettier`, `@types/react`, `@types/react-dom`, `@types/chrome`)
- [x] T002 [P] Configure TypeScript: create `tsconfig.json` with `strict: true`, `lib: ["dom","esnext"]`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `noEmit: true` in repository root
- [x] T003 [P] Configure Vite multi-entry IIFE build: create `vite.config.ts` with `@vitejs/plugin-react`, three `rollupOptions.input` entries (`interceptor`, `content`, `popup`), `output.format: 'iife'`, `output.entryFileNames: '[name].js'`
- [x] T004 [P] Configure Vitest: add `test` block to `vite.config.ts` with `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./tests/setup.ts']`; create `tests/setup.ts` with `@testing-library/jest-dom` import
- [x] T005 [P] Configure ESLint + Prettier: create `.eslintrc.cjs` with TypeScript, React, and import-order rules (`max-complexity: 10`, `no-unused-vars`, `@typescript-eslint/no-explicit-any`); create `.prettierrc`; add lint script to `package.json`
- [x] T006 Create `manifest.json` (Manifest V3): declare `name`, `version`, `permissions: ["activeTab","clipboardWrite"]`, `host_permissions: ["*://mitramite.renaper.gob.ar/*"]`, two `content_scripts` entries (`interceptor.js` with `world: "MAIN"` + `run_at: "document_start"` and `content.js` with default isolated world), `action.default_popup: "popup.html"`, `action.default_icon`, `web_accessible_resources: []`
- [x] T007 [P] Add extension icon: place a 128×128 PNG placeholder at `public/icons/icon-128.png`; add `public/popup/popup.html` static action popup HTML shell (button `id="toggle-btn"`, script `src="popup.js"`)

---

## Phase 2: Foundational

**Purpose**: Shared TypeScript types in `src/types/busqueda.ts` — every later task imports from here. Must be complete before any US implementation begins.

**⚠️ CRITICAL**: No user story work can start until this phase is complete.

- [x] T008 Create shared TypeScript types in `src/types/busqueda.ts`: export `RawBusquedaPayload = unknown`, `AppointmentSlot` interface (fields: `id?`, `fecha`, `hora?`, `sede?`, `tramite?`, `cupos?`), `ParseResult` discriminated union (`kind: 'slots' | 'raw' | 'error'`), `OverlayState` interface (`visible`, `result`, `rawBody`, `copyPending`), `ChromeMessage` union (`TOGGLE_OVERLAY`), `BusquedaEventDetail` interface (`body: string`)

**Checkpoint**: Shared types compiled — all user story phases can now proceed.

---

## Phase 3: User Story 1 — See Available Appointment Data Immediately (P1) 🎯 MVP

**Goal**: Intercept `busqueda.php` responses and display parsed appointment data in a Shadow DOM overlay panel that appears automatically within 500 ms.

**Independent Test**: Load the extension unpacked in Chrome (≥111), navigate to `https://mitramite.renaper.gob.ar/`, trigger a `busqueda.php` request. The overlay panel must appear and display parsed slot data. With no request yet, no panel is shown.

### Tests for User Story 1

> **Write these FIRST — they must FAIL before any implementation.**

- [x] T009 [P] Write failing parser unit tests in `tests/unit/parser.test.ts`: test all `ParseResult` branches — valid JSON array of slots, `{ turnos: [...] }` wrapper, `{ horarios: [...] }` wrapper, `{ data: { turnos: [...] } }` wrapper, empty array, non-JSON string, `{ success: false, error: { codigo, descripcion } }` error response, bare object with no known array key (→ `kind: 'raw'`); test date normalisation (`DD/MM/YYYY` → ISO)
- [x] T010 [P] Write failing Panel state transition tests in `tests/unit/Panel.test.tsx`: test initial state (no panel visible), test panel appears + renders `SlotList` on `mitramite:busqueda` event with valid parse result, test `ErrorBanner` renders on `kind: 'error'` parse result, test `<pre>` renders on `kind: 'raw'` parse result

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement parser in `src/content/parser.ts`: export `parse(rawBody: string): ParseResult` — `JSON.parse`, `extractSlotArray` (checks `turnos`, `horarios`, `resultados`, `data.turnos`, `data`, bare array), `normaliseSlot` (maps raw fields to `AppointmentSlot`, coerces `DD/MM/YYYY` dates, clamps negative `cupos`), `isErrorResponse` + `extractErrorMessage` helpers; all cyclomatic complexity ≤10
- [x] T012 [P] [US1] Implement MAIN-world XHR/fetch interceptor in `src/interceptor/index.ts`: patch `XMLHttpRequest.prototype.open` + `send` with `WeakMap` URL tracking, `addEventListener('load')` callback that filters for `busqueda.php`, `window.fetch` override using `response.clone().text()`, both dispatch `new CustomEvent<BusquedaEventDetail>('mitramite:busqueda', { detail: { body } })` on `window`; original request/response untouched (FR-008)
- [x] T013 [P] [US1] Implement `ErrorBanner` component in `src/content/overlay/ErrorBanner.tsx`: accepts `message: string` prop, renders accessible error text in Spanish, no stack traces, no raw error objects
- [x] T014 [P] [US1] Implement `SlotList` component in `src/content/overlay/SlotList.tsx`: accepts `slots: AppointmentSlot[]` prop; renders a table or list of slots showing `fecha`, `hora`, `sede`, `tramite`, `cupos` (display `—` for absent optional fields); handles empty array with "No hay turnos disponibles" message
- [x] T015 [US1] Implement `Panel` component in `src/content/overlay/Panel.tsx`: manages `OverlayState` via `useState`; listens for `mitramite:busqueda` CustomEvent on `window` via `useEffect` (calls `parse`, sets `result`, `rawBody`, `visible: true`); renders `SlotList`, `<pre>` block, or `ErrorBanner` based on `result.kind`; renders nothing when `visible === false` (depends on T013, T014)
- [x] T016 [P] [US1] Create shadow-root styles in `src/content/overlay/panel.css`: position `fixed`, high `z-index`, defined width/max-height, overflow scroll, neutral background, no styles that could leak outside the shadow root
- [x] T017 [US1] Implement content script entry in `src/content/index.ts`: import `panel.css?inline`, create `<div id="mitramite-ext-root">`, `attachShadow({ mode: 'closed' })`, inject `<style>` with CSS string, `createRoot(mountPoint).render(<Panel ref={...} />)` or use a module-level event to communicate visibility; expose `setVisible` for external callers via a ref or module export (depends on T015, T016)

**Checkpoint**: User Story 1 fully functional — overlay appears when `busqueda.php` fires, shows parsed data, handles errors and raw fallback. `pnpm test:run` should now pass for parser and Panel tests.

---

## Phase 4: User Story 2 — Dismiss and Re-open the Overlay Panel (P2)

**Goal**: Add a close button to dismiss the overlay and a toolbar action popup that toggles it back, without navigating away.

**Independent Test**: After overlay appears, click ✕ — panel disappears. Click toolbar icon → "Toggle Panel" — panel reappears with same data. Trigger a new `busqueda.php` response while hidden — panel auto-reappears with new data.

### Tests for User Story 2

> **Write these FIRST — they must FAIL before implementation.**

- [x] T018 [P] [US2] Extend `tests/unit/Panel.test.tsx` with failing visibility toggle tests: close button click hides panel, `TOGGLE_OVERLAY` message toggles `visible`, new `busqueda.php` event while hidden sets `visible: true` with updated data

### Implementation for User Story 2

- [x] T019 [US2] Add close button and `TOGGLE_OVERLAY` handler to `src/content/overlay/Panel.tsx`: add ✕ close button that calls `setVisible(false)`; ensure new intercepted responses while `visible === false` update data AND set `visible: true` (depends on T015)
- [x] T020 [P] [US2] Create action popup HTML in `public/popup/popup.html`: complete the shell with a "Toggle Panel" button (`id="toggle-btn"`), minimal inline styles, `<script src="popup.js"></script>`
- [x] T021 [US2] Implement popup toggle sender in `src/popup/popup.ts`: `chrome.tabs.query({ active: true, currentWindow: true })` then `chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' })` then `window.close()` (depends on T020)
- [x] T022 [US2] Wire `chrome.runtime.onMessage` listener for `TOGGLE_OVERLAY` in `src/content/index.ts`: add `chrome.runtime.onMessage.addListener` that calls `setVisible(prev => !prev)` when `msg.type === 'TOGGLE_OVERLAY'`; unknown message types silently ignored (depends on T017)

**Checkpoint**: User Stories 1 and 2 both independently functional. Panel can be dismissed and re-opened via popup and auto-reappears on new data.

---

## Phase 5: User Story 3 — Copy Raw Response to Clipboard (P3)

**Goal**: "Copiar JSON" button copies the unmodified raw response body to the clipboard and shows a brief success toast; button is disabled when no data captured yet.

**Independent Test**: Trigger a `busqueda.php` response, open overlay, click "Copiar JSON" — paste into editor and verify the complete raw body. With no response yet, button is disabled.

### Tests for User Story 3

> **Write these FIRST — they must FAIL before implementation.**

- [x] T023 [P] [US3] Extend `tests/unit/Panel.test.tsx` with failing CopyButton tests: button disabled when `rawBody === null`, button enabled when `rawBody` is set, click calls `navigator.clipboard.writeText` with exact `rawBody` value, toast appears after successful copy, toast disappears after timeout

### Implementation for User Story 3

- [x] T024 [P] [US3] Implement `CopyButton` component in `src/content/overlay/CopyButton.tsx`: accepts `rawBody: string | null` prop; renders button disabled when `rawBody === null`; on click calls `navigator.clipboard.writeText(rawBody)` (`clipboardWrite` permission); shows inline "¡Copiado!" toast for 2 s via `useState` + `setTimeout`; no raw errors surfaced to user on clipboard failure — show "Error al copiar" toast instead
- [x] T025 [US3] Integrate `CopyButton` into `src/content/overlay/Panel.tsx`: import and render `<CopyButton rawBody={state.rawBody} />` inside the panel; pass current `rawBody` from `OverlayState` (depends on T015, T024)

**Checkpoint**: All three user stories fully functional. Panel shows data, can be dismissed/reopened, clipboard copy works with toast feedback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, bundle validation, and final verification of all acceptance criteria.

- [x] T026 [P] Verify manifest permissions: review `manifest.json` — confirm exactly `activeTab`, `clipboardWrite` in `permissions` and `*://mitramite.renaper.gob.ar/*` in `host_permissions`; no extra permissions (FR-009, SC-006)
- [x] T027 [P] Run `pnpm coverage` and confirm ≥80% line coverage on `src/content/parser.ts` and `src/content/overlay/Panel.tsx`; add targeted tests for any uncovered branches
- [x] T028 Run `pnpm lint` and `pnpm typecheck` with zero warnings/errors; fix all issues found
- [x] T029 [P] Run `pnpm build` and check `dist/` contents — verify only `interceptor.js`, `content.js`, `popup.js`, `popup.html`, `manifest.json`, `icons/icon-128.png` are present; confirm total unpacked size ≤500 KB (SC-004); no source maps in production output
- [x] T030 Validate `quickstart.md` end-to-end: follow all steps — `pnpm install`, `pnpm build`, load `dist/` unpacked in Chrome ≥111, navigate to `mitramite.renaper.gob.ar`, trigger `busqueda.php` request, verify overlay appears, close it, reopen via popup, click "Copiar JSON"

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — **blocks all user stories**
- **Phase 3 (US1 — P1)**: Depends on Phase 2 — no US dependencies
- **Phase 4 (US2 — P2)**: Depends on Phase 2 and Phase 3 completion (extends Panel.tsx, content/index.ts)
- **Phase 5 (US3 — P3)**: Depends on Phase 2 and Phase 3 completion (extends Panel.tsx)
- **Phase 6 (Polish)**: Depends on all desired user story phases

### User Story Dependencies

| Story    | Depends On       | Notes                                        |
| -------- | ---------------- | -------------------------------------------- |
| US1 (P1) | Phase 2 complete | Core — all other stories build on top        |
| US2 (P2) | US1 complete     | Extends `Panel.tsx` and `content/index.ts`   |
| US3 (P3) | US1 complete     | Extends `Panel.tsx` only; independent of US2 |

### Within Each User Story

1. **Tests FIRST** (write and confirm they fail)
2. **Types/models** before logic
3. **Leaf components** (SlotList, ErrorBanner, CopyButton) before composite (Panel)
4. **Parser** independent of UI — implement in parallel with components
5. **content/index.ts** last in each story (integrates everything)

### Parallel Opportunities

- **Phase 1**: T002–T007 all parallelisable after T001
- **Phase 3**: T009 (parser tests) + T010 (Panel tests) in parallel; T011 (parser) + T012 (interceptor) + T013 (ErrorBanner) + T014 (SlotList) all in parallel; T015 (Panel) after T013 + T014; T016 (CSS) parallel with T015
- **Phase 4**: T018 (tests) in parallel with T019–T022 plan; T020 (popup.html) + T019 (Panel changes) in parallel; T021 depends on T020
- **Phase 5**: T023 (tests) + T024 (CopyButton) in parallel; T025 after both
- **Phase 6**: T026 + T027 + T029 all parallelisable; T028 and T030 sequential

---

## Parallel Execution Example: Phase 3 (User Story 1)

```
T009 ─────────────────────────────────┐
T010 ─────────────────────────────────┤  tests (parallel)
                                      │
T011 (parser) ───────────────────┐    │
T012 (interceptor) ──────────────┤    │
T013 (ErrorBanner) ──────┐       │    ├── T015 (Panel) ── T017 (content/index.ts)
T014 (SlotList)    ──────┘       │    │
T016 (CSS)         ──────────────┘    │
                                      │
All tests above pass ─────────────────┘
```

---

## Implementation Strategy

### MVP Scope (deliver first)

**Phase 1 + Phase 2 + Phase 3 only** — this delivers the entire primary value proposition:

- Intercept `busqueda.php` response
- Parse and display appointment slots in an overlay
- Handle errors and non-JSON fallback gracefully

User Stories 2 and 3 are incremental enhancements that can follow once US1 is verified in the live site.

### Suggested Delivery Order

1. **Sprint 1**: Phase 1 + Phase 2 + Phase 3 (MVP — full US1)
2. **Sprint 2**: Phase 4 (US2 — dismiss/reopen)
3. **Sprint 3**: Phase 5 (US3 — clipboard copy)
4. **Sprint 4**: Phase 6 (Polish + bundle validation)

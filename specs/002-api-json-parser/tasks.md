# Tasks: DNI Status Panel — Parse & Display Tramite API Response

**Input**: Design documents from `/specs/002-api-json-parser/`
**Branch**: `002-api-json-parser`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[US1/US2/US3]**: User story this task belongs to
- Exact file paths are included in every description

---

## Phase 1: Setup

**Purpose**: Discover the tramite-status API endpoint URL (required before the interceptor URL filter can be finalised) and add the placeholder constant to unblock implementation.

- [x] T001 Inspect live network traffic on the Mitramite Argentina portal via DevTools → Network (Fetch/XHR) — submit a DNI status query and record the URL fragment whose JSON response contains `"id_tramite"` (see `specs/002-api-json-parser/quickstart.md § 5`); add `const TRAMITE_URL_FILTER = '<tbd>'` placeholder to `src/interceptor/index.ts` so later tasks compile

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared type definitions in `src/types/busqueda.ts`. Every user-story phase imports from here; nothing else can compile until these types are in place.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Extend `src/types/busqueda.ts` with three new exported interfaces — `EstadoEntry { descripcion: string; fecha: string }`, `OficinaRemitente { descripcion: string; domicilio: string; codigo_postal: string; provincia: string }`, `TramiteStatus` (all 11 fields per `specs/002-api-json-parser/data-model.md`) — and add `{ kind: 'tramite'; tramite: TramiteStatus }` as a new variant to the `ParseResult` discriminated union, inserted between the `slots` and `raw` variants

**Checkpoint**: Types compile — user story phases can now begin.

---

## Phase 3: User Story 1 — View DNI Processing Status at a Glance (P1) 🎯 MVP

**Goal**: When the interceptor captures a tramite-status response, the overlay panel appears within 500 ms showing a structured summary — Document Info section (id_tramite, tipo_tramite, clase_tramite, tipo_dni, descripcion_tramite, fecha_toma) and Status Timeline section (ultimo_estado and anteultimo_estado with descriptions and DD/MM/YYYY dates).

**Independent Test**: Load the extension, navigate to the Mitramite Argentina portal, trigger a DNI status query. The panel must appear and display all Document Info and Status Timeline fields. Run `pnpm test:run` — all parser and Panel tests for the tramite path must pass.

### Tests for User Story 1

> **Write these FIRST — they must FAIL before any implementation.**

- [x] T003 [P] [US1] Write failing parser tests in `tests/unit/parser.test.ts`: `isTramiteResponse` returns `true` for the quickstart.md sample payload and `false` for a payload without `data.id_tramite`; `parse()` with the sample payload returns `{ kind: 'tramite', tramite: TramiteStatus }` with all fields correctly mapped; `formatDateForDisplay('2026-01-15')` returns `'15/01/2026'`, `formatDateForDisplay('15/01/2026')` passes through unchanged; `parse()` with `{ codigo: 1, mensaje: 'Error' }` returns `{ kind: 'error', message: 'Error' }`; `parse()` with the tramite path is reached before the slot-extraction path (FR-007)
- [x] T004 [P] [US1] Create `tests/unit/TramitePanel.test.tsx` with failing render tests: full render with the quickstart.md TramiteStatus fixture shows a "Información del documento" section containing id_tramite, tipo_tramite, clase_tramite, tipo_dni, descripcion_tramite, and fecha_toma labels and values; shows a "Estado del trámite" section containing ultimo_estado.descripcion + ultimo_estado.fecha and anteultimo_estado.descripcion + anteultimo_estado.fecha; when `anteultimo_estado` is `null`, the anteúltimo entry is not rendered
- [x] T005 [P] [US1] Write failing Panel integration tests in `tests/unit/Panel.test.tsx`: `mitramite:busqueda` CustomEvent with a tramite JSON body causes the panel to render `<TramitePanel />`; the panel heading reads "Estado de trámite" for a tramite result; all existing slot, raw, and error test cases continue to pass (regression guard)

### Implementation for User Story 1

- [x] T006 [US1] Implement `formatDateForDisplay(raw: string): string`, `isTramiteResponse(parsed: unknown): boolean`, and `parseTramiteStatus(parsed: unknown): ParseResult` in `src/content/parser.ts`; add `if (isTramiteResponse(parsed)) return parseTramiteStatus(parsed)` as the first branch inside `parse()` before `extractSlotArray`; `parseTramiteStatus` maps all `TramiteStatus` fields (empty-string fallback for absent string fields, `null` for absent `anteultimo_estado`), and returns `{ kind: 'error', message: parsed.mensaje ?? 'Error al consultar el trámite' }` when `parsed.codigo !== 0` (depends on T002; makes T003 pass)
- [x] T007 [US1] Create `src/content/overlay/TramitePanel.tsx` as a pure presentational component with props `{ tramite: TramiteStatus }`: renders two `<section>` elements — "Información del documento" (`<dl>/<dt>/<dd>` pairs for id_tramite, tipo_tramite, clase_tramite, tipo_dni, descripcion_tramite, fecha_toma) and "Estado del trámite" (`<dl>` with último estado description + date; anteúltimo estado description + date only when `tramite.anteultimo_estado !== null`) (depends on T002; makes T004 pass)
- [x] T008 [US1] Extend `src/content/overlay/Panel.tsx`: import `TramitePanel`, add `{result.kind === 'tramite' && <TramitePanel tramite={result.tramite} />}` branch after the `slots` branch, update the dynamic panel title to `"Estado de trámite"` when `result.kind === 'tramite'` (depends on T007; makes T005 pass)
- [x] T009 [P] [US1] Extend `src/interceptor/index.ts`: add URL filter logic using `TRAMITE_URL_FILTER` (from T001) alongside the existing `busqueda.php` check in both the XHR `load` listener and the fetch wrapper; both paths still dispatch `new CustomEvent<BusquedaEventDetail>('mitramite:busqueda', { detail: { body } })` on `window` — no new event name required (depends on T001)

**Checkpoint**: User Story 1 fully functional — overlay appears with Document Info and Status Timeline sections when a tramite-status response is intercepted. `pnpm test:run` passes for all new tramite parser and Panel tests.

---

## Phase 4: User Story 2 — View Office and Delivery Details (P2)

**Goal**: The overlay panel's third section "Oficina & Retiro" displays the RENAPER office name, street address, postal code, province, and the delivery type and postal service. Missing office fields display `'—'`.

**Independent Test**: With a valid tramite-status response intercepted (including `oficina_remitente`), the "Oficina & Retiro" section renders all four office fields and tipo_retiro / correo. Feed a payload with `oficina_remitente` absent — all office values render as `'—'`.

### Tests for User Story 2

> **Write these FIRST — they must FAIL before implementation.**

- [x] T010 [P] [US2] Write failing "Oficina & Retiro" tests in `tests/unit/TramitePanel.test.tsx`: render with full fixture shows "Oficina & Retiro" section with oficina_remitente.descripcion, domicilio, codigo_postal, provincia, tipo_retiro, and correo values; render with `oficina_remitente` entirely absent shows `'—'` for each of the four office fields; render with partial `oficina_remitente` (e.g., `domicilio` present, rest absent) shows `'—'` only for the missing fields

### Implementation for User Story 2

- [x] T011 [US2] Add "Oficina & Retiro" `<section>` to `src/content/overlay/TramitePanel.tsx`: a third `<dl>` block with `<dt>/<dd>` pairs for tipo_retiro, correo, and the four `oficina_remitente` fields; each office field uses the pattern `tramite.oficina_remitente?.descripcion ?? '—'` (and equivalent for the other three fields) (depends on T007; makes T010 pass)

**Checkpoint**: User Stories 1 and 2 both independently functional — panel shows all three labelled sections for valid tramite payloads.

---

## Phase 5: User Story 3 — Graceful Handling of Unknown or Malformed Responses (P3)

**Goal**: The extension does not crash or display garbled data for any unexpected input — non-tramite responses fall through to the existing slot/raw parser, malformed tramite payloads show `ErrorBanner`, and all pre-existing tests continue to pass.

**Independent Test**: Feed `{ codigo: 1, mensaje: 'Error' }` to the content script event — `ErrorBanner` appears with the mensaje text. Feed a busqueda.php slot fixture — `SlotList` still renders correctly. Feed a JSON object with no `data.id_tramite` — neither crashes nor shows tramite panel.

### Tests for User Story 3

> **Write these FIRST — they must FAIL before implementation.**

- [x] T012 [P] [US3] Write failing edge-case parser tests in `tests/unit/parser.test.ts`: payload without `data.id_tramite` → `isTramiteResponse` returns `false` and `parse()` falls through to the slot/raw path (FR-007 backwards compatibility); payload with `data: {}` (empty object) → `isTramiteResponse` returns `false`; tramite payload where `descripcion_anteultimo_estado` and `fecha_anteultimo_estado` are both absent → `anteultimo_estado: null`; `formatDateForDisplay('')` returns `''`; `formatDateForDisplay('2026-01-15T10:30:00')` returns `'15/01/2026'` (datetime with time component); existing busqueda.php slot fixture still returns `kind: 'slots'` after the tramite branch is added
- [x] T013 [P] [US3] Write failing Panel edge-case tests in `tests/unit/Panel.test.tsx`: `mitramite:busqueda` event with `{ codigo: 1, mensaje: 'No se encontró' }` body → panel renders `<ErrorBanner message="No se encontró" />`; `mitramite:busqueda` event with the busqueda.php slot fixture → panel still renders `<SlotList />` (regression guard)

### Implementation for User Story 3

- [x] T014 [US3] Harden `isTramiteResponse`, `parseTramiteStatus`, and `formatDateForDisplay` in `src/content/parser.ts` to pass all edge cases: `isTramiteResponse` guards with `typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string,unknown>)['data'] === 'object'` and a non-empty string check on `id_tramite`; `parseTramiteStatus` uses `typeof raw === 'string' ? raw : ''` for all optional string fields; missing both anteultimo fields → `anteultimo_estado: null`; `formatDateForDisplay` handles empty string → `''`, ISO 8601 datetime (with T) → strips time and converts to DD/MM/YYYY (depends on T006; makes T012 and T013 pass)

**Checkpoint**: All three user stories independently functional. All existing slot/raw/error tests continue to pass. `pnpm test:run` fully green.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Code quality, coverage gate, final build verification, and URL filter finalisation.

- [x] T015 [P] Run `pnpm typecheck` and resolve all TypeScript strict-mode errors across modified files: `src/types/busqueda.ts`, `src/content/parser.ts`, `src/content/overlay/TramitePanel.tsx`, `src/content/overlay/Panel.tsx`, `src/interceptor/index.ts`; confirm zero errors
- [x] T016 [P] Run `pnpm lint` across all modified files and fix any ESLint warnings (zero-warning policy per constitution); verify no `@typescript-eslint/no-explicit-any` violations — all unsafe inputs use `unknown`, not `any`
- [x] T017 Run `pnpm coverage` and confirm overall coverage ≥80% on new code surface; add targeted tests in `tests/unit/parser.test.ts` or `tests/unit/TramitePanel.test.tsx` for any uncovered branches (particularly `formatDateForDisplay` input paths and TramitePanel optional-field fallbacks)
- [x] T018 [P] Run `pnpm build` and confirm the production build succeeds with zero TypeScript errors and no bundle-size regressions; load `dist/` as unpacked extension in Chrome and perform a manual end-to-end smoke test against the live portal (requires T019)
- [x] T019 [P] Replace the `'<tbd>'` placeholder in `TRAMITE_URL_FILTER` inside `src/interceptor/index.ts` with the actual URL fragment discovered during T001; re-run `pnpm build` and `pnpm test:run` to confirm no regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No code dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **blocks all user story phases**
- **User Stories (Phases 3–5)**: All depend on Phase 2 completion
  - Phase 3 (US1) must complete before Phase 4 (US2) and Phase 5 (US3), because US2 extends TramitePanel and US3 hardens the parser introduced in US1
  - Phase 4 (US2) and Phase 5 (US3) can proceed in parallel after Phase 3 is complete
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Depends on T007 (TramitePanel) from US1 — extends the component with a third section
- **US3 (P3)**: Depends on T006 (parser) from US1 — hardens the functions introduced in US1

### Within Each User Story

1. Tests MUST be written and confirmed to **fail** before writing implementation
2. Types (Phase 2) before parser, parser before component, component before Panel wiring
3. Each story complete and green before moving to the next priority

### Parallel Opportunities

- T003, T004, T005 (US1 tests) can all be written simultaneously — different files
- T006 (parser) and T007 (TramitePanel) can be worked in parallel once types (T002) are done — different files
- T009 (interceptor) can be worked in parallel with T006/T007 — different file
- T010 (US2 tests) and T012, T013 (US3 tests) can be written in parallel with US1 implementation
- T015, T016, T018, T019 (Polish) can run in parallel with each other

---

## Parallel Example: User Story 1

```bash
# After T002 (types) is merged — start these three in parallel:

# Terminal 1 — parser
vim tests/unit/parser.test.ts      # T003 (failing tests first)
vim src/content/parser.ts          # T006 (implementation)

# Terminal 2 — component
vim tests/unit/TramitePanel.test.tsx  # T004 (failing tests first)
vim src/content/overlay/TramitePanel.tsx  # T007 (implementation)

# Terminal 3 — interceptor
vim src/interceptor/index.ts       # T009 (URL filter addition)

# Once T007 is done:
# Terminal 4 — Panel wiring
vim tests/unit/Panel.test.tsx      # T005 (failing tests first)
vim src/content/overlay/Panel.tsx  # T008 (implementation)

# Validate
pnpm test:run && pnpm typecheck
```

---

## Implementation Strategy

### MVP Scope (Phase 3 only — User Story 1)

Implement only Phase 1 → Phase 2 → Phase 3 to deliver core value immediately:

- Citizen can see DNI Document Info and Status Timeline in the overlay panel
- Parser correctly detects and routes tramite-status payloads
- All existing slot/raw tests continue to pass
- `pnpm test:run`, `pnpm typecheck`, `pnpm build` all green

### Incremental Delivery

1. **After Phase 3**: Core tramite status visible — delivers SC-001, SC-002, SC-003 (partial)
2. **After Phase 4**: Full office information visible — delivers SC-002 (complete)
3. **After Phase 5**: Edge cases covered — delivers SC-003 (complete), SC-004
4. **After Phase 6**: Production-ready — delivers SC-005, zero-warning policy confirmed

### Format Validation

All 19 tasks follow the required checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`. ✅

# Implementation Plan: DNI Status Panel — Parse & Display Tramite API Response

**Branch**: `002-api-json-parser` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/002-api-json-parser/spec.md`

## Summary

Extend the existing Chrome content-script overlay to recognise, parse, and display
the DNI tramite-status JSON payload returned by the Mitramite Argentina portal. The
parser gains a new `kind: 'tramite'` discriminant; the overlay panel gains a
`TramitePanel` component rendering three labelled sections (Document Info, Status
Timeline, Office & Delivery); the interceptor gains an additional URL filter for the
tramite-status endpoint (URL to be confirmed by live traffic inspection). Full
backwards compatibility with the existing `busqueda.php` appointment-slot path is
preserved unconditionally (FR-007).

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode)  
**Primary Dependencies**: React 18, Vite 5, Vitest 2.x, @testing-library/react 16, happy-dom / jsdom  
**Storage**: N/A  
**Testing**: Vitest unit + @testing-library/react component tests  
**Target Platform**: Chrome MV3 content script (dual-world: MAIN + isolated)  
**Project Type**: Browser extension (overlay content script)  
**Performance Goals**: Panel visible within 500 ms of API response; parser is synchronous and O(1) in response fields  
**Constraints**: No new manifest permissions; backwards-compatible parser; DD/MM/YYYY date display; no blocking of main thread  
**Scale/Scope**: Single-user extension; one active panel instance per tab

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Per `.specify/memory/constitution.md` v1.0.0, verify the following before proceeding:

- [x] **Code Quality**: `isTramiteResponse`, `parseTramiteStatus`, and
      `formatDateForDisplay` are single-responsibility functions added alongside
      the existing parser. `TramitePanel` is a focused presentational component.
      No new external dependencies introduced. ESLint zero-warning policy applies
      to all new and modified files.
- [x] **Testing Standards**: Unit tests for the new parser branch and component
      render tests for `TramitePanel` will be authored before implementation (TDD).
      Coverage ≥80% maintained across new code surface; existing tests unaffected.
- [x] **UX Consistency**: No new VS Code commands are introduced by this feature
      (it operates in the Chrome content-script overlay). Spanish-language labels
      are used for all displayed fields, consistent with the existing panel.
      The `mitramite.<verb>` naming rule applies to VS Code commands — not
      applicable here. No raw error text or stack traces are surfaced to users;
      `ErrorBanner` renders actionable plain-language messages.
- [x] **Performance**: Parser path is synchronous and O(1) in the number of fields;
      negligible CPU impact. No new activation path added to the extension host.
      No new dependencies → bundle-size impact is zero.

_Post-Phase 1 re-check_: All gates remain green after design. No violations.

> No gate violations detected. Complexity Tracking table is omitted.

## Project Structure

### Documentation (this feature)

```text
specs/002-api-json-parser/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── dom-events.md
│   └── response-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── busqueda.ts          # Extend: add TramiteStatus, OficinaRemitente, EstadoEntry; extend ParseResult
├── content/
│   ├── parser.ts            # Extend: isTramiteResponse(), parseTramiteStatus(), formatDateForDisplay()
│   └── overlay/
│       ├── TramitePanel.tsx # NEW: renders 3-section tramite view (Document Info, Status Timeline, Office & Delivery)
│       └── Panel.tsx        # Extend: add tramite branch; dynamic panel title
└── interceptor/
    └── index.ts             # Extend: add TRAMITE_URL_FILTER constant and matching logic

tests/
└── unit/
    ├── parser.test.ts       # Extend: tramite-status parse scenarios (success, error, missing fields)
    ├── TramitePanel.test.tsx # NEW: render, missing-field fallbacks, error display
    └── Panel.test.tsx       # Extend: tramite result branch in Panel render tests
```

**Structure Decision**: Single project. All changes are purely additive to the
existing `src/` layout. No new top-level directories or packages. Test files
mirror source paths under `tests/unit/`.

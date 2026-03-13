# Research: DNI Status Panel — Parse & Display Tramite API Response

**Branch**: `002-api-json-parser` | **Date**: 2026-03-13  
**Phase**: 0 — Outline & Research  
**Sources**: Codebase analysis, spec FR-001–FR-008, existing parser.ts, interceptor/index.ts

---

## Research Question 1: Tramite-Status API Endpoint URL

**Status**: NEEDS TESTING (cannot be determined statically)

- **Decision**: The interceptor URL filter for the tramite-status endpoint must
  be determined by capturing live network traffic on the Mitramite Argentina portal.
  Inspect DevTools → Network while submitting a DNI status query and record the
  matching URL fragment (e.g., `consultarTramite`, `estadoDni`, `tramite.php`).

- **Rationale**: The spec does not specify the endpoint URL. The existing
  interceptor already uses a URL substring match (`busqueda.php`); the same pattern
  can be applied once the URL is known.

- **Interim approach**: Add a second constant `TRAMITE_URL_FILTER = '<tbd>'` to
  `src/interceptor/index.ts`. Both filters dispatch the same `mitramite:busqueda`
  event (reusing the existing channel), and the parser discriminates between
  payload types via `data.id_tramite` presence (FR-001). This avoids any interface
  change in the content-script event listener.

- **Alternatives considered**:
  - _Intercept all fetch/XHR responses_: Rejected — too broad; would process
    every network call on the page, adding unnecessary overhead.
  - _New event name `mitramite:tramite`_: Deferred — would require parallel
    listener additions in content/index.tsx and tests. Reusing `mitramite:busqueda`
    is simpler for v1 given the parser already discriminates by payload kind.

---

## Research Question 2: API Response Date Format

**Status**: RESOLVED

- **Decision**: Normalise all date strings to DD/MM/YYYY for display (FR-008).
  The existing `normaliseDateString` helper in `parser.ts` converts from
  DD/MM/YYYY → ISO 8601 for the slots view. For the tramite view, dates from the
  API may arrive as ISO 8601 (YYYY-MM-DD), DD/MM/YYYY, or ISO 8601 datetime
  strings (YYYY-MM-DDTHH:MM:SS). A new `formatDateForDisplay()` helper will
  convert any of these to DD/MM/YYYY.

- **Rationale**: Argentine users expect DD/MM/YYYY per the spec and portal
  conventions. The existing parser converts to ISO for slot table sorting; the
  tramite panel displays only (no sorting needed) so DD/MM/YYYY is both spec-
  compliant and user-friendly.

- **Alternatives considered**:
  - _Keep ISO 8601 internally and format only at render time_: Valid but adds
    coupling between display format and type definition. Simpler to normalise
    in the parser and store display-ready strings in `EstadoEntry.fecha`.

---

## Research Question 3: Exact JSON Response Schema

**Status**: RESOLVED (derived from spec FR-002 and Key Entities section)

The tramite-status response wraps the payload in a `data` object and includes a
top-level `codigo` error indicator:

```jsonc
{
  "codigo": 0, // 0 = success; non-zero = error
  "data": {
    "id_tramite": "string",
    "tipo_tramite": "string",
    "clase_tramite": "string",
    "tipo_dni": "string",
    "descripcion_tramite": "string",
    "fecha_toma": "string", // date string
    "descripcion_ultimo_estado": "string",
    "fecha_ultimo_estado": "string", // date string
    "descripcion_anteultimo_estado": "string",
    "fecha_anteultimo_estado": "string", // date string
    "tipo_retiro": "string",
    "correo": "string",
    "oficina_remitente": {
      "descripcion": "string",
      "domicilio": "string",
      "codigo_postal": "string",
      "provincia": "string",
    },
  },
}
```

Discrimination rule (FR-001): `typeof parsed?.data?.id_tramite === 'string'`

Error condition (FR-006): `parsed.codigo !== 0` OR any required field in `data`
evaluates to `undefined` after extraction.

---

## Research Question 4: Extending `ParseResult` Discriminated Union

**Status**: RESOLVED

- **Decision**: Add `{ kind: 'tramite'; tramite: TramiteStatus }` to the existing
  `ParseResult` union in `src/types/busqueda.ts`. TypeScript's exhaustive narrowing
  in the Panel's render switch will enforce handling of the new case at compile time.

- **Rationale**: The discriminated union pattern is already established in the
  codebase and understood by all consumers. Adding a new variant has zero runtime
  overhead and minimal change surface.

- **Implementation note**: `Panel.tsx` switch already handles `slots`, `raw`, and
  `error` via JSX conditionals (not a switch statement). Adding a fourth branch
  `result.kind === 'tramite'` follows the same pattern without restructuring.

---

## Research Question 5: `codigo` Field and Error Semantics

**Status**: RESOLVED

- **Decision**: When `parsed.codigo !== 0` (or is absent), return
  `{ kind: 'error', message: <mensaje field or generic fallback> }` directly from
  the tramite parser path. The existing `ErrorBanner` component then renders the
  message without any new UI component.

- **Rationale**: Reusing `kind: 'error'` for API-level errors avoids duplicating
  error display logic. The spec (FR-006) requires a "user-readable error notice"
  — `ErrorBanner` already renders actionable plain-language text.

- **Alternatives considered**:
  - _Error as a field on `TramiteStatus`_: Rejected — mixes success and failure
    state into one type, complicating null-safety.

---

## Research Question 6: Backwards Compatibility Strategy

**Status**: RESOLVED

- **Decision**: In `parse()`, check `isTramiteResponse()` **before**
  `extractSlotArray()`. A tramite-status payload will have `data.id_tramite`; it
  will not have `data.turnos`, `data.horarios`, or `data.resultados`. The existing
  slot-extraction logic never fires for tramite-status payloads.

- **Rationale**: Slot responses do not contain `data.id_tramite` (the busqueda.php
  response schema is a flat or nested array of turno objects, not a `data` wrapper
  with `id_tramite`). The check is therefore non-overlapping.

- **Risk**: A future busqueda.php response that coincidentally contains
  `data.id_tramite` would be misclassified. Mitigated by using a narrow check
  (exact key presence + string type) and by the specificity of the field name.

---

## Research Question 7: Component Architecture for TramitePanel

**Status**: RESOLVED

- **Decision**: Create `src/content/overlay/TramitePanel.tsx` as a pure
  presentational component receiving a `TramiteStatus` prop. It renders three
  `<section>` elements (Document Info, Status Timeline, Office & Delivery),
  each with a labelled `<dl>` definition list. No internal state required.

- **Rationale**: Mirrors the existing `SlotList.tsx` pattern (pure, props-driven).
  `<dl>/<dt>/<dd>` is semantically correct for labelled field/value pairs and
  requires no additional CSS beyond the existing panel stylesheet.

- **Alternatives considered**:
  - _Table layout (like SlotList)_: Rejected — tramite info is label:value pairs,
    not tabular/comparative data. `<dl>` is more semantically appropriate.
  - _Inline in Panel.tsx_: Rejected — violates SRP; Panel is already 70 lines.

---

## Summary of Decisions

| #   | Question                | Decision                                                           |
| --- | ----------------------- | ------------------------------------------------------------------ |
| 1   | Tramite API URL         | TBD by live inspection; use second `URL_FILTER` constant           |
| 2   | Date display format     | DD/MM/YYYY via new `formatDateForDisplay()` helper                 |
| 3   | JSON schema             | `{ codigo, data: { id_tramite, ... oficina_remitente: { ... } } }` |
| 4   | Extending ParseResult   | Add `kind: 'tramite'` variant to discriminated union               |
| 5   | Error semantics         | Non-zero `codigo` → `kind: 'error'`, reuse `ErrorBanner`           |
| 6   | Backwards compatibility | Check `isTramiteResponse()` first in `parse()`                     |
| 7   | Component architecture  | New `TramitePanel.tsx`, pure presentational, `<dl>` layout         |

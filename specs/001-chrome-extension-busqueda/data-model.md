# Data Model: Chrome Extension — Appointment Slot Overlay

**Phase 1 output** | Branch: `001-chrome-extension-busqueda`

---

## Overview

This document defines all typed entities used across the extension. All types live in
`src/types/busqueda.ts` and are imported by the parser, overlay components, and tests.
The schema is defensive — every field from the `busqueda.php` response is treated as
potentially absent (`undefined`) or differently shaped than expected.

---

## Entities

### 1. `RawBusquedaPayload`

The unvalidated JSON value obtained after `JSON.parse(responseText)`. Used only in
the parser layer; nothing outside `parser.ts` touches this type.

```ts
// src/types/busqueda.ts
export type RawBusquedaPayload = unknown;
```

**Validation rules**: None — this is the entry point before any parsing.

---

### 2. `AppointmentSlot`

A single parsed appointment slot, normalised from whichever field names the live
endpoint uses (`turnos`, `horarios`, `resultados`, etc.).

```ts
export interface AppointmentSlot {
  /** Unique identifier for the slot, if present in response */
  id?: string;
  /** Appointment date — normalised to ISO 8601 (YYYY-MM-DD) */
  fecha: string;
  /** Appointment time — HH:MM 24-hour */
  hora?: string;
  /** Display name of the office/location (sede) */
  sede?: string;
  /** Procedure type (tramite), e.g. "DNI", "Pasaporte" */
  tramite?: string;
  /** Remaining available seats/quota */
  cupos?: number;
}
```

**Validation rules**:

- `fecha` must be a non-empty string; coerce Argentine `DD/MM/YYYY` to ISO if detected
- All other fields are optional; display "—" in UI when absent
- `cupos` must be ≥ 0 when present; values < 0 clamped to 0

**State transitions**: Not applicable (value object; immutable once parsed)

---

### 3. `ParseResult`

The discriminated union returned by `parser.ts`. Callers never receive raw text —
they always receive a typed `ParseResult`.

```ts
export type ParseResult =
  | { kind: "slots"; slots: AppointmentSlot[] }
  | { kind: "raw"; rawText: string }
  | { kind: "error"; message: string };
```

| Variant | Condition                                                                    | Panel behaviour        |
| ------- | ---------------------------------------------------------------------------- | ---------------------- |
| `slots` | JSON parsed successfully and at least one slot array found                   | Render `<SlotList>`    |
| `raw`   | JSON parses but no recognised slot array found, OR response is non-JSON text | Render `<pre>` block   |
| `error` | HTTP error status or unrecoverable parser exception                          | Render `<ErrorBanner>` |

---

### 4. `OverlayState`

React state held inside the `Panel` component via `useState`. Represents everything
the overlay needs to render at any moment.

```ts
export interface OverlayState {
  /** Whether the panel is currently shown */
  visible: boolean;
  /** The latest parse result; null before any response received */
  result: ParseResult | null;
  /** Raw response body (preserved for "Copy JSON" button) */
  rawBody: string | null;
  /** True while copying to clipboard (controls toast display) */
  copyPending: boolean;
}
```

**State transitions**:

```
Initial: { visible: false, result: null, rawBody: null, copyPending: false }

Event: busqueda response received
  → { visible: true, result: ParseResult, rawBody: string }

Event: close button clicked
  → { visible: false }

Event: TOGGLE_OVERLAY message
  → { visible: !prev.visible }

Event: new response while hidden
  → { visible: true, result: newResult, rawBody: newRaw }

Event: "Copy JSON" clicked
  → { copyPending: true }
  → (after clipboard write resolves) { copyPending: false }
```

---

### 5. `ChromeMessage`

The typed message objects passed between the action popup and the content script via
`chrome.tabs.sendMessage` / `chrome.runtime.onMessage`.

```ts
export type ChromeMessage = { type: "TOGGLE_OVERLAY" };
```

**Validation rules**: Message type must be one of the known string literals;
unknown message types are silently ignored by the listener.

---

### 6. `BusquedaEvent`

The `CustomEvent` detail type dispatched by the MAIN-world interceptor and received
by the isolated-world content listener.

```ts
export interface BusquedaEventDetail {
  /** Raw response body as a string */
  body: string;
}
```

Usage:

```ts
// MAIN world (interceptor)
window.dispatchEvent(
  new CustomEvent<BusquedaEventDetail>("mitramite:busqueda", {
    detail: { body: responseText },
  }),
);

// Isolated world (content/index.ts)
window.addEventListener("mitramite:busqueda", (e) => {
  const { body } = (e as CustomEvent<BusquedaEventDetail>).detail;
  // ...
});
```

---

## Relationships

```
window CustomEvent
        │  detail.body: string
        ▼
  parser.ts::parse(rawBody: string): ParseResult
        │
        ├─ ParseResult { kind: 'slots', slots: AppointmentSlot[] }
        ├─ ParseResult { kind: 'raw',   rawText: string }
        └─ ParseResult { kind: 'error', message: string }
                │
                ▼
          OverlayState.result
                │
                ├─ SlotList  ← AppointmentSlot[]
                ├─ <pre>     ← rawText
                └─ ErrorBanner ← message

action popup
     │  ChromeMessage { type: 'TOGGLE_OVERLAY' }
     ▼
OverlayState.visible toggled
```

---

## Parser Algorithm (`src/content/parser.ts`)

```ts
export function parse(rawBody: string): ParseResult {
  // 1. Try JSON parse
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    // Non-JSON → raw fallback
    return { kind: "raw", rawText: rawBody };
  }

  // 2. Check for a success:false / error wrapper
  if (isErrorResponse(json)) {
    const msg = extractErrorMessage(json) ?? "Error desconocido";
    return { kind: "error", message: msg };
  }

  // 3. Extract slot array using known candidate keys
  const arr = extractSlotArray(json);
  if (arr && arr.length > 0) {
    return { kind: "slots", slots: arr.map(normaliseSlot) };
  }
  if (arr && arr.length === 0) {
    return { kind: "slots", slots: [] }; // empty — valid, no appointments
  }

  // 4. JSON but unrecognised shape → raw fallback
  return { kind: "raw", rawText: rawBody };
}
```

Private helpers:

- `extractSlotArray(json)` — checks `json.turnos`, `json.horarios`, `json.resultados`,
  `json.data?.turnos`, `json.data`, and bare-array for the first array found
- `normaliseSlot(raw)` — maps raw object fields to `AppointmentSlot`, coerces dates
- `isErrorResponse(json)` — checks `json.success === false` or `json.error?.codigo`
- `extractErrorMessage(json)` — extracts `json.error?.descripcion` or `json.message`

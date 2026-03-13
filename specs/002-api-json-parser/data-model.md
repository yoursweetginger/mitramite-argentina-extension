# Data Model: DNI Status Panel — Parse & Display Tramite API Response

**Branch**: `002-api-json-parser` | **Date**: 2026-03-13  
**Phase**: 1 — Design & Contracts  
**Source**: [spec.md](spec.md) § Key Entities, FR-002, [research.md](research.md) Q3

---

## Overview

Three domain entities model the tramite-status payload. They are all defined in
`src/types/busqueda.ts` alongside the existing slot types and are imported by
the parser, overlay components, and tests.

```text
TramiteStatus
├── id_tramite         string
├── tipo_tramite       string
├── clase_tramite      string
├── tipo_dni           string
├── descripcion_tramite string
├── fecha_toma         string  (DD/MM/YYYY)
├── ultimo_estado      EstadoEntry
├── anteultimo_estado  EstadoEntry | null
├── oficina_remitente  OficinaRemitente
├── tipo_retiro        string
└── correo             string

EstadoEntry
├── descripcion  string
└── fecha        string  (DD/MM/YYYY)

OficinaRemitente
├── descripcion    string
├── domicilio      string
├── codigo_postal  string
└── provincia      string
```

---

## Entity: `TramiteStatus`

Represents the full normalised state of a DNI processing request. Populated
entirely from the `data` field of the API response.

```ts
export interface TramiteStatus {
  /** Unique identifier for the procedure (e.g. "12345678") */
  id_tramite: string;
  /** Procedure type code (e.g. "DNI", "PASAPORTE") */
  tipo_tramite: string;
  /** Category/class of the procedure */
  clase_tramite: string;
  /** DNI type description (e.g. "DUPLICADO") */
  tipo_dni: string;
  /** Human-readable procedure description */
  descripcion_tramite: string;
  /** Submission date, normalised to DD/MM/YYYY */
  fecha_toma: string;
  /** Most recent status transition */
  ultimo_estado: EstadoEntry;
  /** Second-most-recent status transition; null if only one state exists */
  anteultimo_estado: EstadoEntry | null;
  /** Sending RENAPER office */
  oficina_remitente: OficinaRemitente;
  /** Delivery type (e.g. "CORREO", "RETIRO_DELEGACION") */
  tipo_retiro: string;
  /** Postal service / carrier name */
  correo: string;
}
```

### Validation Rules

| Field                                                          | Rule                                      | Fallback                        |
| -------------------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| `id_tramite`                                                   | Must be a non-empty string in `data`      | Detection fails → `kind: 'raw'` |
| `tipo_tramite` … `correo` (strings)                            | Present as string in `data`; may be empty | `''` (empty string)             |
| `fecha_toma`, `ultimo_estado.fecha`, `anteultimo_estado.fecha` | Normalised to DD/MM/YYYY                  | `''` if unparseable             |
| `anteultimo_estado`                                            | Optional; set to `null` if fields absent  | `null`                          |
| `oficina_remitente.*`                                          | Optional object fields                    | `'—'` placeholder for display   |

### State Transitions

Not applicable — `TramiteStatus` is a point-in-time snapshot. The most recent
and second-most-recent status are captured as `ultimo_estado` / `anteultimo_estado`
(FR-004: most recent first).

---

## Entity: `EstadoEntry`

A single timestamped status transition. Used for both `ultimo_estado` and
`anteultimo_estado` within a `TramiteStatus`.

```ts
export interface EstadoEntry {
  /** Human-readable status description (e.g. "EN PRODUCCIÓN") */
  descripcion: string;
  /** Status date, normalised to DD/MM/YYYY */
  fecha: string;
}
```

### Source fields (raw API → normalised)

| Raw API field                        | Normalised into                        |
| ------------------------------------ | -------------------------------------- |
| `data.descripcion_ultimo_estado`     | `ultimo_estado.descripcion`            |
| `data.fecha_ultimo_estado`           | `ultimo_estado.fecha` (DD/MM/YYYY)     |
| `data.descripcion_anteultimo_estado` | `anteultimo_estado.descripcion`        |
| `data.fecha_anteultimo_estado`       | `anteultimo_estado.fecha` (DD/MM/YYYY) |

---

## Entity: `OficinaRemitente`

Represents the RENAPER office responsible for producing the document.
All fields are optional in the raw API payload; missing values display as `'—'`
in the UI (per spec Assumptions).

```ts
export interface OficinaRemitente {
  /** Office name / description (e.g. "DELEGACIÓN BUENOS AIRES") */
  descripcion: string;
  /** Street address */
  domicilio: string;
  /** Postal code (código postal) */
  codigo_postal: string;
  /** Argentine province name */
  provincia: string;
}
```

---

## `ParseResult` Union Extension

The existing `ParseResult` union gains a new `tramite` variant:

```ts
// Before (existing)
export type ParseResult =
  | { kind: 'slots'; slots: AppointmentSlot[] }
  | { kind: 'raw'; rawText: string }
  | { kind: 'error'; message: string };

// After (this feature)
export type ParseResult =
  | { kind: 'slots'; slots: AppointmentSlot[] }
  | { kind: 'tramite'; tramite: TramiteStatus } // NEW
  | { kind: 'raw'; rawText: string }
  | { kind: 'error'; message: string };
```

The `tramite` variant is inserted between `slots` and `raw` so that the most
specific matches are checked first (consistent with the parser order).

---

## `RawTramitePayload` (internal parser type)

Used only within `parser.ts` to type-narrow the raw API response before
extraction. Not exported.

```ts
// Internal to parser.ts
interface RawOficina {
  descripcion?: unknown;
  domicilio?: unknown;
  codigo_postal?: unknown;
  provincia?: unknown;
}

interface RawTramiteData {
  id_tramite?: unknown;
  tipo_tramite?: unknown;
  clase_tramite?: unknown;
  tipo_dni?: unknown;
  descripcion_tramite?: unknown;
  fecha_toma?: unknown;
  descripcion_ultimo_estado?: unknown;
  fecha_ultimo_estado?: unknown;
  descripcion_anteultimo_estado?: unknown;
  fecha_anteultimo_estado?: unknown;
  tipo_retiro?: unknown;
  correo?: unknown;
  oficina_remitente?: unknown;
}
```

---

## Entity Relationship Diagram

```text
ParseResult (discriminated union)
  │
  ├─ kind: 'slots'   → AppointmentSlot[]   (existing)
  ├─ kind: 'tramite' → TramiteStatus       (NEW)
  │                       ├─ ultimo_estado:    EstadoEntry
  │                       ├─ anteultimo_estado: EstadoEntry | null
  │                       └─ oficina_remitente: OficinaRemitente
  ├─ kind: 'raw'     → string              (existing)
  └─ kind: 'error'   → string              (existing)
```

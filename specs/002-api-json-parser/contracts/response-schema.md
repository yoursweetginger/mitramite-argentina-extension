# Contract: Tramite-Status API Response Schema

**Scope**: The JSON payload returned by the Mitramite Argentina portal when a
citizen queries the status of their DNI processing request. This contract defines
the wire format that `src/content/parser.ts` must consume.

---

## Endpoint

| Property         | Value                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **URL filter**   | TBD — must be determined by inspecting live network traffic on the Mitramite Argentina portal (see [research.md § Q1](../research.md)) |
| **Method**       | GET or POST (portal-specific)                                                                                                          |
| **Content-Type** | `application/json`                                                                                                                     |
| **Consumer**     | `src/interceptor/index.ts` → `src/content/parser.ts`                                                                                   |

---

## Success Response

```jsonc
{
  "codigo": 0,
  "data": {
    "id_tramite": "12345678",
    "tipo_tramite": "NUEVA",
    "clase_tramite": "ORDINARIO",
    "tipo_dni": "DUPLICADO",
    "descripcion_tramite": "DNI - PRIMERA VEZ",
    "fecha_toma": "2026-01-15", // may be ISO 8601 or DD/MM/YYYY
    "descripcion_ultimo_estado": "EN PRODUCCIÓN",
    "fecha_ultimo_estado": "2026-02-10", // may be ISO 8601 or DD/MM/YYYY
    "descripcion_anteultimo_estado": "INGRESADO",
    "fecha_anteultimo_estado": "2026-01-16",
    "tipo_retiro": "CORREO",
    "correo": "CORREO ARGENTINO",
    "oficina_remitente": {
      "descripcion": "DELEGACIÓN BUENOS AIRES NORTE",
      "domicilio": "AV. CABILDO 3067",
      "codigo_postal": "1429",
      "provincia": "BUENOS AIRES",
    },
  },
}
```

### Field Definitions

| Field                                  | Type     | Required                | Notes                                                                              |
| -------------------------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `codigo`                               | `number` | Yes                     | `0` = success; any other value = API error                                         |
| `data`                                 | `object` | Yes when `codigo === 0` | Absent or empty on error                                                           |
| `data.id_tramite`                      | `string` | Yes                     | **Detection key** — presence identifies this as a tramite-status response (FR-001) |
| `data.tipo_tramite`                    | `string` | Yes                     |                                                                                    |
| `data.clase_tramite`                   | `string` | Yes                     |                                                                                    |
| `data.tipo_dni`                        | `string` | Yes                     |                                                                                    |
| `data.descripcion_tramite`             | `string` | Yes                     |                                                                                    |
| `data.fecha_toma`                      | `string` | Yes                     | Date; normalised to DD/MM/YYYY in parser (FR-008)                                  |
| `data.descripcion_ultimo_estado`       | `string` | Yes                     |                                                                                    |
| `data.fecha_ultimo_estado`             | `string` | Yes                     | Date; normalised to DD/MM/YYYY                                                     |
| `data.descripcion_anteultimo_estado`   | `string` | No                      | May be absent if only one status exists                                            |
| `data.fecha_anteultimo_estado`         | `string` | No                      | May be absent if only one status exists                                            |
| `data.tipo_retiro`                     | `string` | Yes                     |                                                                                    |
| `data.correo`                          | `string` | Yes                     |                                                                                    |
| `data.oficina_remitente`               | `object` | No                      | May be absent or partially populated                                               |
| `data.oficina_remitente.descripcion`   | `string` | No                      | Display as `'—'` if missing                                                        |
| `data.oficina_remitente.domicilio`     | `string` | No                      | Display as `'—'` if missing                                                        |
| `data.oficina_remitente.codigo_postal` | `string` | No                      | Display as `'—'` if missing                                                        |
| `data.oficina_remitente.provincia`     | `string` | No                      | Display as `'—'` if missing                                                        |

---

## Error Response

Returned when the API cannot process the query (e.g., tramite not found).

```jsonc
{
  "codigo": 1,
  "mensaje": "No se encontró el trámite solicitado",
}
```

| Field     | Type     | Notes                                           |
| --------- | -------- | ----------------------------------------------- |
| `codigo`  | `number` | Non-zero — always non-zero in error responses   |
| `mensaje` | `string` | Optional; used as the user-facing error message |

### Parser behaviour on error response

- If `parsed.codigo !== 0`: return `{ kind: 'error', message: parsed.mensaje ?? 'Error al consultar el trámite' }`
- The `ErrorBanner` component renders the message (FR-006)

---

## Detection Logic (Parser)

```ts
function isTramiteResponse(parsed: unknown): boolean {
  return (
    isObject(parsed) &&
    isObject(parsed['data']) &&
    typeof (parsed['data'] as Record<string, unknown>)['id_tramite'] === 'string'
  );
}
```

This check is applied **before** the slot-extraction logic in `parse()` to
preserve backwards compatibility (FR-007, research.md § Q6).

---

## Invariants

| Invariant                   | Description                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Single detection key**    | `data.id_tramite` Must be present as a string for the tramite path; any other shape falls through to existing slot/raw parsing |
| **Non-overlapping schemas** | Slot responses (`busqueda.php`) do not contain `data.id_tramite`; the detection is non-ambiguous                               |
| **Normalised dates**        | All date strings are converted to DD/MM/YYYY before being stored in `TramiteStatus`                                            |
| **Null-safe office**        | Missing `oficina_remitente` or any of its fields maps to `'—'` for display                                                     |
| **Error bubbles up**        | Non-zero `codigo` returns `kind: 'error'` regardless of `data` contents                                                        |

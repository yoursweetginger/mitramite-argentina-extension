# Quickstart: DNI Status Panel — Parse & Display Tramite API Response

**Branch**: `002-api-json-parser` | **Date**: 2026-03-13  
**Phase**: 1 — Design & Contracts

This guide sets up a local development environment and describes how to iterate
on the feature. It assumes the repository is already cloned and that a recent
version of Node.js (≥20) and pnpm (≥9) are installed.

---

## Prerequisites

```bash
# Verify toolchain
node --version   # should be ≥20.x
pnpm --version   # should be ≥9.x
```

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Run the test suite

The project uses Vitest for all unit and component tests.

```bash
# Run once and exit (CI mode)
pnpm test:run

# Watch mode (re-runs on file save — recommended during development)
pnpm test

# With coverage report
pnpm coverage
# Open coverage/lcov-report/index.html to inspect line coverage
```

---

## 3. Build the extension

```bash
pnpm build
# Outputs to dist/ (created by the Vite build + build.mjs wrapper)
```

---

## 4. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the `dist/` directory
4. Pin the Mitramite extension to the toolbar

---

## 5. Discover the tramite-status API URL

> **Required before implementing the interceptor URL filter.**

1. Open the Mitramite Argentina portal in Chrome with the extension loaded.
2. Open DevTools → **Network** tab, filter by **Fetch/XHR**.
3. Submit a DNI status query (enter a tramite number and click search).
4. Identify the API request whose response contains `"id_tramite"` in the JSON body.
5. Copy the URL path fragment (e.g., `consultarTramite`, `tramite/estado`, etc.)
6. Set `TRAMITE_URL_FILTER` in `src/interceptor/index.ts`:

   ```ts
   const TRAMITE_URL_FILTER = '<your-fragment-here>';
   ```

---

## 6. Development workflow for this feature

### Step A — Write failing tests first (TDD, per Constitution § II)

```bash
# Add new test cases to tests/unit/parser.test.ts
# Add tests/unit/TramitePanel.test.tsx
pnpm test  # they should fail at this point
```

### Step B — Extend types

Edit `src/types/busqueda.ts`:

- Add `EstadoEntry`, `OficinaRemitente`, `TramiteStatus` interfaces
- Add `| { kind: 'tramite'; tramite: TramiteStatus }` to `ParseResult`

See [data-model.md](data-model.md) for exact shapes.

### Step C — Extend the parser

Edit `src/content/parser.ts`:

1. Add `isTramiteResponse(parsed)` guard function
2. Add `parseTramiteStatus(parsed)` extraction function
3. Add `formatDateForDisplay(raw)` helper (converts ISO 8601 and DD/MM/YYYY → DD/MM/YYYY)
4. Call `isTramiteResponse` / `parseTramiteStatus` inside `parse()` before the
   slot-extraction path

### Step D — Add `TramitePanel` component

Create `src/content/overlay/TramitePanel.tsx`:

- Props: `{ tramite: TramiteStatus }`
- Three `<section>` blocks with `<dl>/<dt>/<dd>` for Document Info, Status
  Timeline, and Office & Delivery
- Falls back to `'—'` for any missing optional field

### Step E — Wire into Panel

Edit `src/content/overlay/Panel.tsx`:

- Import `TramitePanel`
- Add `{result.kind === 'tramite' && <TramitePanel tramite={result.tramite} />}`
  after the `slots` branch
- Update the panel title to reflect tramite context when `result.kind === 'tramite'`

### Step F — Extend the interceptor

Edit `src/interceptor/index.ts`:

- Add `TRAMITE_URL_FILTER` constant (see Step 5 above)
- Add the URL check in both the XHR `load` handler and the fetch wrapper
- Both paths dispatch `mitramite:busqueda` (reuses existing event channel)

### Step G — Verify

```bash
pnpm test:run      # all tests green, including new tramite tests
pnpm coverage      # ≥80% coverage maintained
pnpm lint          # zero warnings
pnpm typecheck     # zero type errors
pnpm build         # successful build
```

---

## 7. Sample test payload

Use this JSON in unit tests to verify tramite parsing:

```json
{
  "codigo": 0,
  "data": {
    "id_tramite": "99887766",
    "tipo_tramite": "NUEVA",
    "clase_tramite": "ORDINARIO",
    "tipo_dni": "PRIMERA VEZ",
    "descripcion_tramite": "DNI CON CHIP",
    "fecha_toma": "2026-01-15",
    "descripcion_ultimo_estado": "EN PRODUCCIÓN",
    "fecha_ultimo_estado": "2026-02-10",
    "descripcion_anteultimo_estado": "INGRESADO",
    "fecha_anteultimo_estado": "2026-01-16",
    "tipo_retiro": "CORREO",
    "correo": "CORREO ARGENTINO",
    "oficina_remitente": {
      "descripcion": "DELEGACIÓN CENTRO",
      "domicilio": "AV. CALLAO 110",
      "codigo_postal": "1022",
      "provincia": "CIUDAD AUTÓNOMA DE BUENOS AIRES"
    }
  }
}
```

Error payload:

```json
{ "codigo": 1, "mensaje": "No se encontró el trámite solicitado" }
```

Missing `anteultimo_estado` payload (edge case):

```json
{
  "codigo": 0,
  "data": {
    "id_tramite": "11223344",
    "tipo_tramite": "RENOVACION",
    "clase_tramite": "URGENTE",
    "tipo_dni": "RENOVACIÓN",
    "descripcion_tramite": "DNI RENOVACIÓN",
    "fecha_toma": "15/03/2026",
    "descripcion_ultimo_estado": "ENTREGADO",
    "fecha_ultimo_estado": "20/03/2026",
    "tipo_retiro": "RETIRO_DELEGACION",
    "correo": ""
  }
}
```

---

## 8. Useful commands reference

| Command          | Purpose                         |
| ---------------- | ------------------------------- |
| `pnpm test`      | Vitest watch mode               |
| `pnpm test:run`  | Single test run (CI)            |
| `pnpm coverage`  | Coverage report (target ≥80%)   |
| `pnpm lint`      | ESLint with zero-warning policy |
| `pnpm typecheck` | TypeScript strict type check    |
| `pnpm build`     | Production extension build      |

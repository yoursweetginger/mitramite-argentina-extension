import type { AppointmentSlot, EstadoEntry, OficinaRemitente, ParseResult, RawBusquedaPayload, TramiteStatus } from '../types/busqueda';

const ARRAY_KEYS = ['turnos', 'horarios', 'resultados'] as const;

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val);
}

// Convert DD/MM/YYYY to ISO 8601 YYYY-MM-DD
function normaliseDateString(raw: string): string {
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = ddmmyyyy.exec(raw);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return raw;
}

function strField(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  return typeof val === 'string' ? val : undefined;
}

function normaliseFecha(raw: string | undefined): string {
  return raw !== undefined ? normaliseDateString(raw) : '';
}

function normaliseSlot(raw: unknown): AppointmentSlot {
  if (!isObject(raw)) {
    return { fecha: '' };
  }
  const slot: AppointmentSlot = { fecha: normaliseFecha(strField(raw, 'fecha')) };
  const id = strField(raw, 'id');
  const hora = strField(raw, 'hora');
  const sede = strField(raw, 'sede');
  const tramite = strField(raw, 'tramite');
  const rawCupos = raw['cupos'];

  if (id !== undefined) slot.id = id;
  if (hora !== undefined) slot.hora = hora;
  if (sede !== undefined) slot.sede = sede;
  if (tramite !== undefined) slot.tramite = tramite;
  if (typeof rawCupos === 'number') slot.cupos = Math.max(0, rawCupos);

  return slot;
}

function extractSlotArray(parsed: RawBusquedaPayload): unknown[] | null {
  if (isArray(parsed)) {
    return parsed;
  }
  if (!isObject(parsed)) {
    return null;
  }
  // Check top-level known array keys
  for (const key of ARRAY_KEYS) {
    const val = parsed[key];
    if (isArray(val)) {
      return val;
    }
  }
  // Check data.turnos
  const data = parsed['data'];
  if (isObject(data)) {
    for (const key of ARRAY_KEYS) {
      const val = data[key];
      if (isArray(val)) {
        return val;
      }
    }
    if (isArray(data)) {
      return data;
    }
  }
  return null;
}

function isErrorResponse(parsed: RawBusquedaPayload): boolean {
  if (!isObject(parsed)) return false;
  return parsed['success'] === false && isObject(parsed['error']);
}

function extractErrorMessage(parsed: RawBusquedaPayload): string {
  if (!isObject(parsed)) return 'Error desconocido';
  const error = parsed['error'];
  if (isObject(error)) {
    if (typeof error['descripcion'] === 'string') return error['descripcion'];
    if (typeof error['message'] === 'string') return error['message'];
  }
  return 'Error desconocido';
}

// ─── Tramite-status helpers ───────────────────────────────────────────────────

/**
 * Converts YYYY-MM-DD (or ISO 8601 datetime) to DD/MM/YYYY.
 * DD/MM/YYYY input is passed through unchanged.
 * Empty string returns empty string.
 */
export function formatDateForDisplay(raw: string): string {
  if (raw === '') return '';
  // Strip time component from ISO 8601 datetime (e.g. 2026-01-15T10:30:00)
  const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
  // YYYY-MM-DD → DD/MM/YYYY
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (isoDate) {
    return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  }
  // Already DD/MM/YYYY — pass through
  return raw;
}

function strFieldSafe(obj: Record<string, unknown>, key: string): string {
  const val = obj[key];
  return typeof val === 'string' ? val : '';
}

export function isTramiteResponse(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj['data'] !== 'object' || obj['data'] === null) return false;
  const data = obj['data'] as Record<string, unknown>;
  return typeof data['id_tramite'] === 'string' && data['id_tramite'] !== '';
}

/** Detects any tramite API response (success OR error) by the presence of a numeric `codigo` field. */
function isTramiteApiResponse(parsed: unknown): parsed is Record<string, unknown> {
  if (!isObject(parsed)) return false;
  return typeof parsed['codigo'] === 'number';
}

function parseTramiteStatus(parsed: Record<string, unknown>): ParseResult {
  const data = parsed['data'] as Record<string, unknown>;
  const codigoRaw = parsed['codigo'];
  const codigo = typeof codigoRaw === 'number' ? codigoRaw : 1;
  if (codigo !== 0) {
    const msg = typeof parsed['mensaje'] === 'string' ? parsed['mensaje'] : 'Error al consultar el trámite';
    return { kind: 'error', message: msg };
  }

  const rawOficina = typeof data['oficina_remitente'] === 'object' && data['oficina_remitente'] !== null
    ? (data['oficina_remitente'] as Record<string, unknown>)
    : {} as Record<string, unknown>;

  const oficina: OficinaRemitente = {
    descripcion: strFieldSafe(rawOficina, 'descripcion'),
    domicilio: strFieldSafe(rawOficina, 'domicilio'),
    codigo_postal: strFieldSafe(rawOficina, 'codigo_postal'),
    provincia: strFieldSafe(rawOficina, 'provincia'),
  };

  const hasAnteultimo =
    typeof data['descripcion_anteultimo_estado'] === 'string' &&
    data['descripcion_anteultimo_estado'] !== '' ||
    typeof data['fecha_anteultimo_estado'] === 'string' &&
    data['fecha_anteultimo_estado'] !== '';

  const anteultimo: EstadoEntry | null = hasAnteultimo
    ? {
        descripcion: strFieldSafe(data, 'descripcion_anteultimo_estado'),
        fecha: formatDateForDisplay(strFieldSafe(data, 'fecha_anteultimo_estado')),
      }
    : null;

  const tramite: TramiteStatus = {
    id_tramite: strFieldSafe(data, 'id_tramite'),
    tipo_tramite: strFieldSafe(data, 'tipo_tramite'),
    clase_tramite: strFieldSafe(data, 'clase_tramite'),
    tipo_dni: strFieldSafe(data, 'tipo_dni'),
    descripcion_tramite: strFieldSafe(data, 'descripcion_tramite'),
    fecha_toma: formatDateForDisplay(strFieldSafe(data, 'fecha_toma')),
    ultimo_estado: {
      descripcion: strFieldSafe(data, 'descripcion_ultimo_estado'),
      fecha: formatDateForDisplay(strFieldSafe(data, 'fecha_ultimo_estado')),
    },
    anteultimo_estado: anteultimo,
    oficina_remitente: oficina,
    tipo_retiro: strFieldSafe(data, 'tipo_retiro'),
    correo: strFieldSafe(data, 'correo'),
  };

  return { kind: 'tramite', tramite };
}

export function parse(rawBody: string): ParseResult {
  let parsed: RawBusquedaPayload;
  try {
    parsed = JSON.parse(rawBody) as RawBusquedaPayload;
  } catch {
    return { kind: 'raw', rawText: rawBody };
  }

  if (isTramiteApiResponse(parsed)) {
    return parseTramiteStatus(parsed);
  }

  if (isErrorResponse(parsed)) {
    return { kind: 'error', message: extractErrorMessage(parsed) };
  }

  const slotArray = extractSlotArray(parsed);
  if (slotArray !== null) {
    return { kind: 'slots', slots: slotArray.map(normaliseSlot) };
  }

  return { kind: 'raw', rawText: rawBody };
}
import type { AppointmentSlot, ParseResult, RawBusquedaPayload } from '../types/busqueda';

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

export function parse(rawBody: string): ParseResult {
  let parsed: RawBusquedaPayload;
  try {
    parsed = JSON.parse(rawBody) as RawBusquedaPayload;
  } catch {
    return { kind: 'raw', rawText: rawBody };
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

import { describe, it, expect } from 'vitest';
import { parse, isTramiteResponse, formatDateForDisplay } from '../../src/content/parser';
import type { AppointmentSlot } from '../../src/types/busqueda';

describe('parse()', () => {
  // --- valid JSON array of slots (bare array) ---
  it('returns kind:slots for a bare JSON array of slot objects', () => {
    const slots: AppointmentSlot[] = [
      { fecha: '2026-03-20', hora: '09:00', sede: 'Buenos Aires', tramite: 'DNI', cupos: 3 },
    ];
    const result = parse(JSON.stringify(slots));
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].fecha).toBe('2026-03-20');
    }
  });

  // --- { turnos: [...] } wrapper ---
  it('extracts slots from { turnos: [...] } wrapper', () => {
    const body = JSON.stringify({
      turnos: [{ fecha: '20/03/2026', hora: '10:00', sede: 'Córdoba', tramite: 'Pasaporte' }],
    });
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots[0].fecha).toBe('2026-03-20');
      expect(result.slots[0].sede).toBe('Córdoba');
    }
  });

  // --- { horarios: [...] } wrapper ---
  it('extracts slots from { horarios: [...] } wrapper', () => {
    const body = JSON.stringify({
      horarios: [{ fecha: '21/03/2026', hora: '11:30', cupos: 5 }],
    });
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots[0].fecha).toBe('2026-03-21');
      expect(result.slots[0].cupos).toBe(5);
    }
  });

  // --- { data: { turnos: [...] } } wrapper ---
  it('extracts slots from { data: { turnos: [...] } } deep wrapper', () => {
    const body = JSON.stringify({
      data: { turnos: [{ fecha: '22/03/2026', hora: '08:00', tramite: 'DNI' }] },
    });
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots[0].fecha).toBe('2026-03-22');
    }
  });

  // --- empty array ---
  it('returns kind:slots with empty array for empty slots array', () => {
    const body = JSON.stringify({ turnos: [] });
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots).toHaveLength(0);
    }
  });

  // --- non-JSON string ---
  it('returns kind:raw for non-JSON text', () => {
    const result = parse('this is not json at all');
    expect(result.kind).toBe('raw');
    if (result.kind === 'raw') {
      expect(result.rawText).toBe('this is not json at all');
    }
  });

  // --- { success: false, error: { codigo, descripcion } } error response ---
  it('returns kind:error for { success: false, error: { codigo, descripcion } }', () => {
    const body = JSON.stringify({
      success: false,
      error: { codigo: 404, descripcion: 'No se encontraron turnos' },
    });
    const result = parse(body);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toContain('No se encontraron turnos');
    }
  });

  // --- bare object with no known array key → kind:'raw' ---
  it('returns kind:raw for JSON object with no recognised slot array key', () => {
    const body = JSON.stringify({ foo: 'bar', count: 42 });
    const result = parse(body);
    expect(result.kind).toBe('raw');
  });

  // --- date normalisation: DD/MM/YYYY → ISO ---
  it('normalises DD/MM/YYYY dates to ISO 8601 YYYY-MM-DD', () => {
    const body = JSON.stringify([{ fecha: '05/01/2026' }]);
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots[0].fecha).toBe('2026-01-05');
    }
  });

  // --- cupos negative clamping ---
  it('clamps negative cupos to 0', () => {
    const body = JSON.stringify([{ fecha: '2026-03-20', cupos: -5 }]);
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots[0].cupos).toBe(0);
    }
  });

  // --- resultados wrapper ---
  it('extracts slots from { resultados: [...] } wrapper', () => {
    const body = JSON.stringify({
      resultados: [{ fecha: '2026-04-01', hora: '14:00' }],
    });
    const result = parse(body);
    expect(result.kind).toBe('slots');
    if (result.kind === 'slots') {
      expect(result.slots[0].fecha).toBe('2026-04-01');
    }
  });
});

// ─── isTramiteResponse ────────────────────────────────────────────────────────

describe('isTramiteResponse()', () => {
  const samplePayload = {
    codigo: 0,
    data: {
      id_tramite: '99887766',
      tipo_tramite: 'NUEVA',
      clase_tramite: 'ORDINARIO',
      tipo_dni: 'PRIMERA VEZ',
      descripcion_tramite: 'DNI CON CHIP',
      fecha_toma: '2026-01-15',
      descripcion_ultimo_estado: 'EN PRODUCCIÓN',
      fecha_ultimo_estado: '2026-02-10',
      descripcion_anteultimo_estado: 'INGRESADO',
      fecha_anteultimo_estado: '2026-01-16',
      tipo_retiro: 'CORREO',
      correo: 'CORREO ARGENTINO',
      oficina_remitente: {
        descripcion: 'DELEGACIÓN CENTRO',
        domicilio: 'AV. CALLAO 110',
        codigo_postal: '1022',
        provincia: 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
      },
    },
  };

  it('returns true for the quickstart.md sample payload', () => {
    expect(isTramiteResponse(samplePayload)).toBe(true);
  });

  it('returns false for a payload without data.id_tramite', () => {
    expect(isTramiteResponse({ codigo: 0, data: { tipo_tramite: 'NUEVA' } })).toBe(false);
  });

  it('returns false for a payload without data', () => {
    expect(isTramiteResponse({ codigo: 1, mensaje: 'Error' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTramiteResponse(null)).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isTramiteResponse('string')).toBe(false);
  });
});

// ─── formatDateForDisplay ─────────────────────────────────────────────────────

describe('formatDateForDisplay()', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDateForDisplay('2026-01-15')).toBe('15/01/2026');
  });

  it('passes through DD/MM/YYYY unchanged', () => {
    expect(formatDateForDisplay('15/01/2026')).toBe('15/01/2026');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateForDisplay('')).toBe('');
  });

  it('strips time component from ISO 8601 datetime (with T)', () => {
    expect(formatDateForDisplay('2026-01-15T10:30:00')).toBe('15/01/2026');
  });
});

// ─── parse() with tramite payload ────────────────────────────────────────────

describe('parse() — tramite path', () => {
  const sampleBody = JSON.stringify({
    codigo: 0,
    data: {
      id_tramite: '99887766',
      tipo_tramite: 'NUEVA',
      clase_tramite: 'ORDINARIO',
      tipo_dni: 'PRIMERA VEZ',
      descripcion_tramite: 'DNI CON CHIP',
      fecha_toma: '2026-01-15',
      descripcion_ultimo_estado: 'EN PRODUCCIÓN',
      fecha_ultimo_estado: '2026-02-10',
      descripcion_anteultimo_estado: 'INGRESADO',
      fecha_anteultimo_estado: '2026-01-16',
      tipo_retiro: 'CORREO',
      correo: 'CORREO ARGENTINO',
      oficina_remitente: {
        descripcion: 'DELEGACIÓN CENTRO',
        domicilio: 'AV. CALLAO 110',
        codigo_postal: '1022',
        provincia: 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
      },
    },
  });

  it('returns kind:tramite for the sample payload', () => {
    const result = parse(sampleBody);
    expect(result.kind).toBe('tramite');
  });

  it('maps all TramiteStatus fields correctly', () => {
    const result = parse(sampleBody);
    expect(result.kind).toBe('tramite');
    if (result.kind === 'tramite') {
      const { tramite } = result;
      expect(tramite.id_tramite).toBe('99887766');
      expect(tramite.tipo_tramite).toBe('NUEVA');
      expect(tramite.clase_tramite).toBe('ORDINARIO');
      expect(tramite.tipo_dni).toBe('PRIMERA VEZ');
      expect(tramite.descripcion_tramite).toBe('DNI CON CHIP');
      expect(tramite.fecha_toma).toBe('15/01/2026');
      expect(tramite.ultimo_estado.descripcion).toBe('EN PRODUCCIÓN');
      expect(tramite.ultimo_estado.fecha).toBe('10/02/2026');
      expect(tramite.anteultimo_estado).not.toBeNull();
      expect(tramite.anteultimo_estado?.descripcion).toBe('INGRESADO');
      expect(tramite.anteultimo_estado?.fecha).toBe('16/01/2026');
      expect(tramite.tipo_retiro).toBe('CORREO');
      expect(tramite.correo).toBe('CORREO ARGENTINO');
      expect(tramite.oficina_remitente.descripcion).toBe('DELEGACIÓN CENTRO');
    }
  });

  it('returns kind:error for { codigo: 1, mensaje: "Error" }', () => {
    const result = parse(JSON.stringify({ codigo: 1, mensaje: 'Error' }));
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.message).toBe('Error');
    }
  });

  it('tramite path is reached before slot-extraction path (FR-007)', () => {
    // A tramite payload should never return kind:'slots' or kind:'raw'
    const result = parse(sampleBody);
    expect(result.kind).not.toBe('slots');
    expect(result.kind).not.toBe('raw');
  });

  it('busqueda.php slot fixture still returns kind:slots after tramite branch added', () => {
    const body = JSON.stringify({
      turnos: [{ fecha: '2026-03-20', hora: '09:00', sede: 'CABA', tramite: 'DNI' }],
    });
    const result = parse(body);
    expect(result.kind).toBe('slots');
  });
});

// ─── Edge-case tests (T012 / US3) ────────────────────────────────────────────

describe('parse() — edge cases (US3)', () => {
  it('payload without data.id_tramite falls through to slot/raw path', () => {
    const body = JSON.stringify({ data: { tipo_tramite: 'NUEVA' } });
    const result = parse(body);
    expect(result.kind).not.toBe('tramite');
    // No codigo field → falls through to raw
    expect(result.kind).toBe('raw');
  });

  it('payload with data: {} falls through to raw path', () => {
    const body = JSON.stringify({ data: {} });
    const result = parse(body);
    expect(result.kind).toBe('raw');
  });

  it('tramite payload missing both anteultimo fields → anteultimo_estado: null', () => {
    const body = JSON.stringify({
      codigo: 0,
      data: {
        id_tramite: '11223344',
        tipo_tramite: 'RENOVACION',
        clase_tramite: 'URGENTE',
        tipo_dni: 'RENOVACIÓN',
        descripcion_tramite: 'DNI RENOVACIÓN',
        fecha_toma: '15/03/2026',
        descripcion_ultimo_estado: 'ENTREGADO',
        fecha_ultimo_estado: '20/03/2026',
        tipo_retiro: 'RETIRO_DELEGACION',
        correo: '',
      },
    });
    const result = parse(body);
    expect(result.kind).toBe('tramite');
    if (result.kind === 'tramite') {
      expect(result.tramite.anteultimo_estado).toBeNull();
    }
  });

  it('existing busqueda.php slot fixture returns kind:slots (regression guard)', () => {
    const body = JSON.stringify({
      turnos: [{ fecha: '2026-03-20', hora: '10:00', sede: 'Córdoba' }],
    });
    expect(parse(body).kind).toBe('slots');
  });
});

describe('formatDateForDisplay() — edge cases (US3)', () => {
  it('returns empty string for empty input', () => {
    expect(formatDateForDisplay('')).toBe('');
  });

  it('strips time component from ISO 8601 datetime with T', () => {
    expect(formatDateForDisplay('2026-01-15T10:30:00')).toBe('15/01/2026');
  });

  it('passes through DD/MM/YYYY unchanged', () => {
    expect(formatDateForDisplay('15/01/2026')).toBe('15/01/2026');
  });
});

describe('isTramiteResponse() — edge cases (US3)', () => {
  it('returns false for payload without data.id_tramite', () => {
    expect(isTramiteResponse({ data: { tipo_tramite: 'NUEVA' } })).toBe(false);
  });

  it('returns false for payload with data: {}', () => {
    expect(isTramiteResponse({ data: {} })).toBe(false);
  });
});

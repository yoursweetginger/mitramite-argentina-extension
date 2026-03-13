import { describe, it, expect } from 'vitest';
import { parse } from '../../src/content/parser';
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

// src/types/busqueda.ts
// Shared TypeScript types for the Mitramite Chrome extension.
// All types are imported by parser, overlay components, and tests.

export type RawBusquedaPayload = unknown;

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

export type ParseResult =
  | { kind: 'slots'; slots: AppointmentSlot[] }
  | { kind: 'raw'; rawText: string }
  | { kind: 'error'; message: string };

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

export type ChromeMessage = { type: 'TOGGLE_OVERLAY' };

export interface BusquedaEventDetail {
  /** Raw response body as a string */
  body: string;
}

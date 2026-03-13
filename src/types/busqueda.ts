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

export interface EstadoEntry {
  /** Human-readable status description (e.g. "EN PRODUCCIÓN") */
  descripcion: string;
  /** Status date, normalised to DD/MM/YYYY */
  fecha: string;
}

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

export type ParseResult =
  | { kind: 'slots'; slots: AppointmentSlot[] }
  | { kind: 'tramite'; tramite: TramiteStatus }
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

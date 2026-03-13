import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TramitePanel } from '../../src/content/overlay/TramitePanel';
import type { TramiteStatus } from '../../src/types/busqueda';

const fullFixture: TramiteStatus = {
  id_tramite: '99887766',
  tipo_tramite: 'NUEVA',
  clase_tramite: 'ORDINARIO',
  tipo_dni: 'PRIMERA VEZ',
  descripcion_tramite: 'DNI CON CHIP',
  fecha_toma: '15/01/2026',
  ultimo_estado: { descripcion: 'EN PRODUCCIÓN', fecha: '10/02/2026' },
  anteultimo_estado: { descripcion: 'INGRESADO', fecha: '16/01/2026' },
  oficina_remitente: {
    descripcion: 'DELEGACIÓN CENTRO',
    domicilio: 'AV. CALLAO 110',
    codigo_postal: '1022',
    provincia: 'CIUDAD AUTÓNOMA DE BUENOS AIRES',
  },
  tipo_retiro: 'CORREO',
  correo: 'CORREO ARGENTINO',
};

// ─── US1: Document Info & Status Timeline ────────────────────────────────────

describe('TramitePanel — Document Info section (US1)', () => {
  it('renders "Información del documento" section heading', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('Información del documento')).toBeInTheDocument();
  });

  it('shows id_tramite value', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('99887766')).toBeInTheDocument();
  });

  it('shows tipo_tramite value', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('NUEVA')).toBeInTheDocument();
  });

  it('shows clase_tramite value', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('ORDINARIO')).toBeInTheDocument();
  });

  it('shows tipo_dni value', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('PRIMERA VEZ')).toBeInTheDocument();
  });

  it('shows descripcion_tramite value', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('DNI CON CHIP')).toBeInTheDocument();
  });

  it('shows fecha_toma value', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('15/01/2026')).toBeInTheDocument();
  });
});

describe('TramitePanel — Status Timeline section (US1)', () => {
  it('renders "Estado del trámite" section heading', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('Estado del trámite')).toBeInTheDocument();
  });

  it('shows ultimo_estado.descripcion', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('EN PRODUCCIÓN')).toBeInTheDocument();
  });

  it('shows ultimo_estado.fecha', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('10/02/2026')).toBeInTheDocument();
  });

  it('shows anteultimo_estado.descripcion when present', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('INGRESADO')).toBeInTheDocument();
  });

  it('shows anteultimo_estado.fecha when present', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('16/01/2026')).toBeInTheDocument();
  });

  it('does not render anteúltimo entry when anteultimo_estado is null', () => {
    const noAnteultimo: TramiteStatus = { ...fullFixture, anteultimo_estado: null };
    render(<TramitePanel tramite={noAnteultimo} />);
    expect(screen.queryByText('INGRESADO')).toBeNull();
    expect(screen.queryByText('16/01/2026')).toBeNull();
  });
});

// ─── US2: Office & Delivery section ──────────────────────────────────────────

describe('TramitePanel — Oficina & Retiro section (US2)', () => {
  it('renders "Oficina & Retiro" section heading', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('Oficina & Retiro')).toBeInTheDocument();
  });

  it('shows oficina_remitente.descripcion', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('DELEGACIÓN CENTRO')).toBeInTheDocument();
  });

  it('shows oficina_remitente.domicilio', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('AV. CALLAO 110')).toBeInTheDocument();
  });

  it('shows oficina_remitente.codigo_postal', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('1022')).toBeInTheDocument();
  });

  it('shows oficina_remitente.provincia', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('CIUDAD AUTÓNOMA DE BUENOS AIRES')).toBeInTheDocument();
  });

  it('shows tipo_retiro', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('CORREO')).toBeInTheDocument();
  });

  it('shows correo', () => {
    render(<TramitePanel tramite={fullFixture} />);
    expect(screen.getByText('CORREO ARGENTINO')).toBeInTheDocument();
  });

  it('shows "—" for each office field when oficina_remitente is absent', () => {
    const noOficina: TramiteStatus = {
      ...fullFixture,
      oficina_remitente: { descripcion: '', domicilio: '', codigo_postal: '', provincia: '' },
    };
    render(<TramitePanel tramite={noOficina} />);
    // There should be 4 dashes (one per office field)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });
});

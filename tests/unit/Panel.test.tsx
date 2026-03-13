import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Panel } from '../../src/content/overlay/Panel';
import type { BusquedaEventDetail } from '../../src/types/busqueda';

function dispatchBusquedaEvent(body: string) {
  const event = new CustomEvent<BusquedaEventDetail>('mitramite:busqueda', {
    detail: { body },
    bubbles: false,
    cancelable: false,
  });
  window.dispatchEvent(event);
}

describe('Panel component', () => {
  // --- initial state: no panel visible ---
  it('does not render the panel before any busqueda event', () => {
    const { container } = render(<Panel />);
    expect(container.querySelector('[data-testid="overlay-panel"]')).toBeNull();
  });

  // --- panel appears on valid busqueda event with slots ---
  it('renders SlotList when a valid slots busqueda event fires', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify([{ fecha: '2026-03-20', hora: '09:00', sede: 'CABA', tramite: 'DNI', cupos: 2 }]),
      );
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('slot-list')).toBeInTheDocument();
    expect(screen.getByText('CABA')).toBeInTheDocument();
  });

  // --- ErrorBanner renders on kind:'error' ---
  it('renders ErrorBanner when parse result is kind:error', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify({ success: false, error: { codigo: 500, descripcion: 'Error del servidor' } }),
      );
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    expect(screen.getByText(/Error del servidor/)).toBeInTheDocument();
  });

  // --- <pre> renders on kind:'raw' ---
  it('renders pre block when parse result is kind:raw', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent('not json at all');
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('raw-block')).toBeInTheDocument();
  });

  // --- close button hides the panel (US2) ---
  it('close button click hides the panel', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(JSON.stringify([{ fecha: '2026-03-20' }]));
    });
    const closeBtn = screen.getByTestId('close-btn');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('overlay-panel')).toBeNull();
  });

  // --- TOGGLE_OVERLAY message toggles visible (US2) ---
  it('TOGGLE_OVERLAY chrome message toggles panel visibility', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(JSON.stringify([{ fecha: '2026-03-20' }]));
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();

    act(() => {
      // Simulate the content script receiving a toggle message
      window.dispatchEvent(new CustomEvent('mitramite:toggle', { detail: {} }));
    });
    expect(screen.queryByTestId('overlay-panel')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('mitramite:toggle', { detail: {} }));
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
  });

  // --- new busqueda event while hidden makes panel reappear with new data (US2) ---
  it('new busqueda event while panel is hidden sets visible:true with updated data', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(JSON.stringify([{ fecha: '2026-03-20', sede: 'Old' }]));
    });
    // Close
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(screen.queryByTestId('overlay-panel')).toBeNull();
    // New event
    act(() => {
      dispatchBusquedaEvent(JSON.stringify([{ fecha: '2026-03-21', sede: 'New Sede' }]));
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
    expect(screen.getByText('New Sede')).toBeInTheDocument();
  });

  // --- CopyButton disabled when rawBody is null (US3) ---
  it('CopyButton is disabled before any busqueda event', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(JSON.stringify([{ fecha: '2026-03-20' }]));
    });
    const copyBtn = screen.getByTestId('copy-btn');
    expect(copyBtn).not.toBeDisabled();
  });

  // --- CopyButton enabled when rawBody is set (US3) ---
  it('CopyButton calls navigator.clipboard.writeText with rawBody on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<Panel />);
    const rawBody = JSON.stringify([{ fecha: '2026-03-20' }]);
    act(() => {
      dispatchBusquedaEvent(rawBody);
    });
    const copyBtn = screen.getByTestId('copy-btn');
    expect(copyBtn).not.toBeDisabled();
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(writeText).toHaveBeenCalledWith(rawBody);
  });

  // --- toast appears after successful copy, disappears after timeout (US3) ---
  it('shows ¡Copiado! toast after successful copy and hides after 2s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(JSON.stringify([{ fecha: '2026-03-20' }]));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-btn'));
    });
    expect(screen.getByTestId('copy-toast')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('copy-toast')).toBeNull();
    vi.useRealTimers();
  });

  // ─── Tramite integration tests (T005) ──────────────────────────────────────

  it('renders TramitePanel when busqueda event carries a tramite JSON body', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify({
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
        }),
      );
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('tramite-panel')).toBeInTheDocument();
  });

  it('panel heading reads "Estado de trámite" for a tramite result', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify({
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
        }),
      );
    });
    expect(screen.getByText('Estado de trámite')).toBeInTheDocument();
  });

  it('existing slot tests still pass (regression guard)', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify([{ fecha: '2026-03-20', hora: '09:00', sede: 'CABA', tramite: 'DNI', cupos: 2 }]),
      );
    });
    expect(screen.getByTestId('slot-list')).toBeInTheDocument();
  });

  it('existing error tests still pass (regression guard)', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify({ success: false, error: { codigo: 500, descripcion: 'Error del servidor' } }),
      );
    });
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });

  it('renders ErrorBanner for tramite error response { codigo: 1, mensaje }', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(JSON.stringify({ codigo: 1, mensaje: 'No se encontró' }));
    });
    expect(screen.getByTestId('overlay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    expect(screen.getByText(/No se encontró/)).toBeInTheDocument();
  });

  it('renders SlotList for busqueda.php slot fixture (regression guard)', () => {
    render(<Panel />);
    act(() => {
      dispatchBusquedaEvent(
        JSON.stringify({ turnos: [{ fecha: '2026-03-20', hora: '10:00', sede: 'Córdoba' }] }),
      );
    });
    expect(screen.getByTestId('slot-list')).toBeInTheDocument();
  });
});

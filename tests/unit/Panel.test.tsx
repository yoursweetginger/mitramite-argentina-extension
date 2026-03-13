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
});

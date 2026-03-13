import { useState, useEffect } from 'react';

import { parse } from '../parser';
import type { BusquedaEventDetail, OverlayState } from '../../types/busqueda';

import { SlotList } from './SlotList';
import { ErrorBanner } from './ErrorBanner';
import { CopyButton } from './CopyButton';
import { TramitePanel } from './TramitePanel';

const INITIAL_STATE: OverlayState = {
  visible: false,
  result: null,
  rawBody: null,
  copyPending: false,
};

export function Panel() {
  const [state, setState] = useState<OverlayState>(INITIAL_STATE);

  useEffect(() => {
    function onBusqueda(evt: Event) {
      const detail = (evt as CustomEvent<BusquedaEventDetail>).detail;
      const result = parse(detail.body);
      setState((prev) => ({ ...prev, visible: true, result, rawBody: detail.body }));
    }

    function onToggle() {
      setState((prev) => ({ ...prev, visible: !prev.visible }));
    }

    window.addEventListener('mitramite:busqueda', onBusqueda);
    window.addEventListener('mitramite:toggle', onToggle);
    return () => {
      window.removeEventListener('mitramite:busqueda', onBusqueda);
      window.removeEventListener('mitramite:toggle', onToggle);
    };
  }, []);

  if (!state.visible || state.result === null) {
    return null;
  }

  function close() {
    setState((prev) => ({ ...prev, visible: false }));
  }

  const { result } = state;

  return (
    <div data-testid="overlay-panel" id="mitramite-panel">
      <div id="mitramite-panel-header">
        <span id="mitramite-panel-title">
          {result.kind === 'tramite' ? 'Estado de trámite' : 'Turnos disponibles — Mitramite'}
        </span>
        <button
          data-testid="close-btn"
          id="mitramite-close-btn"
          onClick={close}
          aria-label="Cerrar panel"
          type="button"
        >
          ✕
        </button>
      </div>

      {result.kind === 'slots' && <SlotList slots={result.slots} />}
      {result.kind === 'tramite' && <TramitePanel tramite={result.tramite} />}
      {result.kind === 'raw' && (
        <pre data-testid="raw-block">{result.rawText}</pre>
      )}
      {result.kind === 'error' && <ErrorBanner message={result.message} />}

      <CopyButton rawBody={state.rawBody} />
    </div>
  );
}

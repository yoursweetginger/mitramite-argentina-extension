import { useState } from 'react';

interface CopyButtonProps {
  rawBody: string | null;
}

export function CopyButton({ rawBody }: CopyButtonProps) {
  const [toast, setToast] = useState<'success' | 'error' | null>(null);

  async function handleClick() {
    if (rawBody === null) return;
    try {
      await navigator.clipboard.writeText(rawBody);
      setToast('success');
    } catch {
      setToast('error');
    } finally {
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <span>
      <button
        data-testid="copy-btn"
        id="mitramite-copy-btn"
        onClick={handleClick}
        disabled={rawBody === null}
        aria-label="Copiar JSON al portapapeles"
        type="button"
      >
        Copiar JSON
      </button>
      {toast === 'success' && (
        <span data-testid="copy-toast" id="mitramite-copy-toast">
          ¡Copiado!
        </span>
      )}
      {toast === 'error' && (
        <span data-testid="copy-toast" id="mitramite-copy-toast" style={{ color: '#c0392b' }}>
          Error al copiar
        </span>
      )}
    </span>
  );
}

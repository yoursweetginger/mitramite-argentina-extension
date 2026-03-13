import type { BusquedaEventDetail } from '../types/busqueda';

// MAIN-world content script.
// Patches window.fetch and window.XMLHttpRequest to intercept busqueda.php responses
// and forward the raw body to the isolated-world content script via CustomEvent.

const URL_FILTER = 'busqueda.php';

function dispatchBusquedaEvent(body: string): void {
  const event = new CustomEvent<BusquedaEventDetail>('mitramite:busqueda', {
    detail: { body },
    bubbles: false,
    cancelable: false,
  });
  window.dispatchEvent(event);
}

// --- XHR interception ---
const xhrUrlMap = new WeakMap<XMLHttpRequest, string>();
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string,
  password?: string
) {
  xhrUrlMap.set(this, typeof url === 'string' ? url : url.toString());
  if (async !== undefined) {
    return originalOpen.call(this, method, url, async, username ?? null, password ?? null);
  }
  return (originalOpen as (method: string, url: string | URL) => void).call(this, method, url);
};

XMLHttpRequest.prototype.send = function (...args) {
  const url = xhrUrlMap.get(this) ?? '';
  if (url.includes(URL_FILTER)) {
    this.addEventListener('load', () => {
      dispatchBusquedaEvent(this.responseText);
    });
  }
  return originalSend.apply(this, args);
};

// --- fetch interception ---
const originalFetch = window.fetch.bind(window);

window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const response = await originalFetch(input, init);
  if (url.includes(URL_FILTER)) {
    const cloned = response.clone();
    cloned.text().then(dispatchBusquedaEvent).catch(() => undefined);
  }
  return response;
};

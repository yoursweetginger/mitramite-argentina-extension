import { createRoot } from 'react-dom/client';

import panelCss from './overlay/panel.css?inline';
import { Panel } from './overlay/Panel';

// Mount shadow DOM overlay
const host = document.createElement('div');
host.id = 'mitramite-ext-root';
document.documentElement.appendChild(host);

const shadow = host.attachShadow({ mode: 'closed' });

const style = document.createElement('style');
style.textContent = panelCss;
shadow.appendChild(style);

const mountPoint = document.createElement('div');
shadow.appendChild(mountPoint);

createRoot(mountPoint).render(<Panel />);

// Forward chrome.runtime messages to the Panel via CustomEvent
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isTypedMessage(message)) return;
  if (message.type === 'TOGGLE_OVERLAY') {
    window.dispatchEvent(new CustomEvent('mitramite:toggle', { detail: {} }));
  }
});

function isTypedMessage(msg: unknown): msg is { type: string } {
  return typeof msg === 'object' && msg !== null && 'type' in msg;
}

# Contract: Chrome Runtime Messages (Popup → Content Script)

**Scope**: Messages passed from the action popup (`src/popup/popup.ts`) to the
isolated-world content script (`src/content/index.ts`) via `chrome.tabs.sendMessage`.

---

## Message: `TOGGLE_OVERLAY`

Sent by the action popup when the user clicks the toolbar icon and then the toggle
button in the popup.

### Producer

`src/popup/popup.ts` — called after `chrome.tabs.query({ active: true, currentWindow: true })`.

### Consumer

`src/content/index.ts` — `chrome.runtime.onMessage.addListener(handler)`.

### Shape

```ts
interface ToggleOverlayMessage {
  type: "TOGGLE_OVERLAY";
}
```

### Wire format example

```json
{ "type": "TOGGLE_OVERLAY" }
```

### Invariants

| Invariant                | Description                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **No response required** | The content script does not send a response; the popup closes immediately via `window.close()`                                     |
| **Fire-and-forget**      | If the content script is not yet injected (page hasn't loaded), the message is silently dropped; no error handling needed in popup |
| **Idempotent dispatch**  | Sending `TOGGLE_OVERLAY` when the panel is already hidden still results in the panel being shown (toggle semantics)                |
| **One message type**     | No other message types are passed over this channel in v1                                                                          |

---

## Message Handler Contract (Content Script Side)

```ts
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isTypedMessage(message)) return;
  if (message.type === "TOGGLE_OVERLAY") {
    setVisible((prev) => !prev);
  }
  // Unknown types are silently ignored
});

function isTypedMessage(msg: unknown): msg is { type: string } {
  return typeof msg === "object" && msg !== null && "type" in msg;
}
```

### Permissions Required

| Permission       | Reason                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| `activeTab`      | Required for `chrome.tabs.query` to resolve the active tab ID               |
| `clipboardWrite` | Required for Clipboard API (`navigator.clipboard.writeText`) — see manifest |

> `clipboardWrite` is declared in `manifest.json` but used in `src/content/overlay/CopyButton.tsx`,
> not in the popup. It is listed here for completeness.

---

## No Background / Service Worker Messages

This extension has **no background script or service worker**. All cross-context
communication flows directly:

```
Action Popup (popup context)
      │  chrome.tabs.sendMessage
      ▼
Content Script (isolated world, tab context)
```

There is no intermediate relay through a service worker.

# Contract: Custom DOM Events (Interceptor → Overlay)

**Scope**: Communication between the MAIN-world content script (`src/interceptor/index.ts`)
and the isolated-world content script (`src/content/index.ts`) via window-level CustomEvents.

---

## Event: `mitramite:busqueda`

Fired by the MAIN-world interceptor whenever a network response to a URL containing
`busqueda.php` is received in full.

### Producer

`src/interceptor/index.ts` — fired from both the XHR `load` listener and the `fetch`
wrapper after `response.clone().text()` resolves.

### Consumer

`src/content/index.ts` — `window.addEventListener('mitramite:busqueda', handler)`.

### Shape

```ts
interface BusquedaEventDetail {
  /** Complete raw response body as a UTF-8 string */
  body: string;
}

new CustomEvent<BusquedaEventDetail>("mitramite:busqueda", {
  detail: { body: "..." },
  bubbles: false,
  cancelable: false,
});
```

### Invariants

| Invariant             | Description                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No modification**   | The `body` string is the verbatim response body; it MUST NOT be modified before dispatch (FR-008)                                                                        |
| **UTF-8 string only** | `detail.body` is always a `string`; binary/blob responses are out of scope                                                                                               |
| **Replace semantics** | Rapid successive firings replace (not queue) data in the overlay — the consumer always processes only the latest event (SC spec: "multiple calls replace previous data") |
| **One producer**      | Only `src/interceptor/index.ts` may dispatch this event name                                                                                                             |

### Security Notes

- The consumer validates that the event originates from `window` (same document) —
  cross-frame injection of this event name is not possible via `window.dispatchEvent`
  called from another frame's script.
- The `detail.body` string is parsed defensively (see `parser.ts`); it is never
  passed to `eval`, `innerHTML`, or `dangerouslySetInnerHTML` directly.
- The shadow root isolates rendered HTML from the host page's DOM.

---

## Event: (none for teardown)

Content scripts are destroyed when the tab navigates. No explicit teardown event is
defined; the `window.addEventListener` listener is garbage-collected automatically.
State does not persist across navigations (FR-010).

# Contract: Custom DOM Events (Interceptor → Overlay)

**Scope**: Communication between the MAIN-world content script
(`src/interceptor/index.ts`) and the isolated-world content script
(`src/content/index.tsx`) via window-level CustomEvents.

**Version note**: Extended in feature `002-api-json-parser` to also carry
tramite-status response bodies over the existing `mitramite:busqueda` channel.
The parser discriminates between payload types (slots vs. tramite-status) via
the `data.id_tramite` field (see [response-schema.md](response-schema.md)).

---

## Event: `mitramite:busqueda`

Fired by the MAIN-world interceptor whenever a network response to a URL
containing a monitored filter string is received in full.

**Monitored URL filters** (as of feature 002):

- `busqueda.php` — appointment-slot responses
- `<tramite-URL-fragment>` — tramite-status responses (TBD; see [research.md § Q1](../research.md))

### Producer

`src/interceptor/index.ts` — fired from both the XHR `load` listener and the
`fetch` wrapper after `response.clone().text()` resolves.

### Consumer

`src/content/index.tsx` — `window.addEventListener('mitramite:busqueda', handler)`.
The handler passes `detail.body` to `parse()`, which returns the appropriate
`ParseResult` variant (`slots`, `tramite`, `raw`, or `error`).

### Shape

```ts
interface BusquedaEventDetail {
  /** Complete raw response body as a UTF-8 string */
  body: string;
}

new CustomEvent<BusquedaEventDetail>('mitramite:busqueda', {
  detail: { body: '...' },
  bubbles: false,
  cancelable: false,
});
```

### Invariants

| Invariant             | Description                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **No modification**   | The `body` string is the verbatim response body; MUST NOT be modified before dispatch                                  |
| **UTF-8 string only** | `detail.body` is always a `string`; binary/blob responses are out of scope                                             |
| **Replace semantics** | Rapid successive firings replace (not queue) data in the overlay — the consumer always processes only the latest event |
| **One producer**      | Only `src/interceptor/index.ts` may dispatch this event name                                                           |

### Security Notes

- The consumer validates that the event originates from `window` (same document).
- `detail.body` is parsed defensively in `parser.ts`; it is never passed to
  `eval`, `innerHTML`, or `dangerouslySetInnerHTML`.
- The shadow root isolates rendered HTML from the host page's DOM.

---

## Event: `mitramite:toggle`

Fired by the isolated-world content script when a `TOGGLE_OVERLAY` chrome
message is received. Consumed by the `Panel` React component.

### Producer

`src/content/index.tsx` — inside `chrome.runtime.onMessage.addListener`.

### Consumer

`src/content/overlay/Panel.tsx` — `window.addEventListener('mitramite:toggle', handler)`.

### Shape

```ts
new CustomEvent('mitramite:toggle', {
  detail: {},
  bubbles: false,
  cancelable: false,
});
```

### Invariants

| Invariant            | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| **Toggle semantics** | Each dispatch flips panel visibility regardless of current state |
| **No payload**       | `detail` is an empty object; no data required for toggle         |

---

## Event: (none for teardown)

Content scripts are destroyed when the tab navigates. No explicit teardown event
is defined; `window.addEventListener` listeners are garbage-collected automatically.
State does not persist across navigations.

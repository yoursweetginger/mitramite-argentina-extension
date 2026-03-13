# Feature Specification: Chrome Extension — Appointment Slot Overlay for mitramite.renaper.gob.ar

**Feature Branch**: `001-chrome-extension-busqueda`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Build a Chrome extension that shows on the page https://mitramite.renaper.gob.ar/ information from the response of the request https://mitramite.renaper.gob.ar/busqueda.php"

## Context

The Argentine government appointment portal (mitramite.renaper.gob.ar) lets citizens
book slots for identity-document procedures (DNI, passport, etc.). The page uses an
XHR/fetch call to `/busqueda.php` to retrieve available appointment data. Without
additional tooling, that raw JSON/HTML response is never surfaced to the user in a
convenient summary view — citizens must navigate through multiple dropdowns to
manually discover availability.

This Chrome extension intercepts responses to `busqueda.php`, parses the payload, and
injects a readable overlay panel directly into the page so the user can instantly see
available slots without any extra navigation.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — See Available Appointment Data Immediately (Priority: P1)

A citizen navigates to `https://mitramite.renaper.gob.ar/`, performs a search
(triggering a request to `busqueda.php`), and immediately sees a compact overlay
panel on the page that summarises the appointment data returned — without needing to
inspect Network DevTools or read raw JSON.

**Why this priority**: This is the entire purpose of the extension. All other stories
are enhancements on top of this baseline value.

**Independent Test**: Load the extension in Chrome, navigate to the mitramite page,
trigger a `busqueda.php` request. The overlay panel must appear and display the
parsed appointment data.

**Acceptance Scenarios**:

1. **Given** the extension is installed and enabled, **When** the page issues a
   request to `busqueda.php` and receives a response, **Then** an overlay panel
   appears on the page showing the parsed appointment information within 500 ms.
2. **Given** the overlay panel is visible, **When** the user reads the panel,
   **Then** they can see key fields (available dates, times, locations, procedure
   type) in plain Spanish without needing developer tools.
3. **Given** no `busqueda.php` request has been made yet, **When** the page loads,
   **Then** no overlay is shown (the extension is silent until data is available).

---

### User Story 2 — Dismiss and Re-open the Overlay Panel (Priority: P2)

The user can close the overlay panel when they no longer need it and re-open it via
an extension toolbar icon or a floating toggle button, without navigating away.

**Why this priority**: The overlay must not permanently obscure page content.
Dismissibility is essential for basic usability.

**Independent Test**: After the overlay appears, click the close/dismiss button.
Verify the panel disappears. Then click the extension icon or floating toggle.
Verify the panel reappears with the last received data.

**Acceptance Scenarios**:

1. **Given** the overlay is visible, **When** the user clicks the close button,
   **Then** the overlay hides without affecting the underlying page.
2. **Given** the overlay is hidden, **When** the user clicks the extension toolbar
   icon, **Then** the overlay reappears with the most recently captured data.
3. **Given** the overlay is hidden and a new `busqueda.php` response arrives,
   **Then** the overlay automatically reappears with the new data.

---

### User Story 3 — Copy Raw Response to Clipboard (Priority: P3)

The user can copy the full raw JSON payload from the last `busqueda.php` response to
the clipboard with a single click, for use in external tools or sharing.

**Why this priority**: Power users and developers may want to analyse the full
response. This adds utility without complicating the primary flow.

**Independent Test**: Trigger a `busqueda.php` response, open the overlay, click
"Copy JSON". Paste into a text editor and verify it contains the complete unmodified
response body.

**Acceptance Scenarios**:

1. **Given** response data has been captured, **When** the user clicks "Copy JSON",
   **Then** the raw response body is written to the clipboard and a brief success
   toast appears.
2. **Given** no response has been captured yet, **When** the user opens the overlay,
   **Then** the "Copy JSON" button is disabled.

---

### Edge Cases

- What happens when `busqueda.php` returns a non-200 status or a network error?
  → The overlay shows a human-readable error message ("No se pudo obtener datos de
  disponibilidad") and does not crash.
- What happens when the response body is not valid JSON?
  → The extension falls back to displaying the raw text in a `<pre>` block inside
  the overlay rather than failing silently.
- What happens if the page navigates away while the overlay is open?
  → The content script is destroyed with the page; no state leaks to other tabs.
- What happens if multiple `busqueda.php` calls fire in quick succession?
  → Each new response replaces the previous data in the overlay; no duplicates.
- What happens if the user has the extension installed but the page structure
  changes (new URL path for busqueda)?
  → The overlay simply does not appear; the extension degrades gracefully.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The extension MUST intercept HTTP responses to URLs matching
  `*://mitramite.renaper.gob.ar/busqueda.php*` using the Chrome
  `declarativeNetRequest` API or a service-worker–based `fetch` interceptor via
  content-script message passing.
- **FR-002**: The extension MUST parse the response body as JSON; if parsing fails,
  it MUST fall back to displaying raw text.
- **FR-003**: The extension MUST inject an overlay panel into the DOM of
  `https://mitramite.renaper.gob.ar/*` pages that displays the parsed data.
- **FR-004**: The overlay MUST be dismissible (close button) and re-openable
  (toolbar icon + floating toggle button).
- **FR-005**: The overlay MUST update automatically when a new `busqueda.php`
  response is received.
- **FR-006**: The extension MUST provide a "Copy JSON" button that copies the raw
  response to the clipboard.
- **FR-007**: The extension MUST display a user-friendly error message when the
  response indicates a failure or parsing error; raw stack traces MUST NOT be shown.
- **FR-008**: The extension MUST NOT modify or interfere with the original
  `busqueda.php` request or response (read-only interception).
- **FR-009**: The extension MUST request only the minimal Chrome permissions
  required: `activeTab`, `clipboardWrite`, and host permission for
  `*://mitramite.renaper.gob.ar/*`.
- **FR-010**: The extension MUST work without any external network calls of its own;
  all logic runs locally in the browser.

### Key Entities

- **BusquedaResponse**: The raw payload from `busqueda.php`. Key attributes:
  available appointment dates, times, office/location identifiers, procedure type.
  Exact schema determined during Phase 0 research.
- **OverlayPanel**: The injected UI element. Attributes: visibility state (shown/
  hidden), last-captured `BusquedaResponse`, error state.
- **ExtensionState**: Service-worker or background-page held state. Attributes:
  latest response per tab, panel visibility preference.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The overlay appears within 500 ms of the `busqueda.php` response
  being received by the browser.
- **SC-002**: 100 % of key appointment fields present in the response are displayed
  in the overlay (verified against a known fixture response during testing).
- **SC-003**: The extension adds zero perceptible load time to the mitramite page
  (activation and content-script injection complete in < 150 ms).
- **SC-004**: The packaged extension (`.crx` / unpacked) is ≤ 500 KB with no
  external CDN dependencies.
- **SC-005**: Unit tests cover ≥ 80 % of the response-parsing and overlay-rendering
  logic.
- **SC-006**: The extension requests no more permissions than those listed in
  FR-009 — verified by manifest review.

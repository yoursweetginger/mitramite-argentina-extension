# Feature Specification: DNI Status Panel — Parse & Display Tramite API Response

**Feature Branch**: `002-api-json-parser`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "Add support for parsing JSON responses from the Mitramite Argentina API. When the interceptor captures a network response, it should parse the JSON body, extract relevant job listing fields, and make them available for the overlay panel."

## Context

The Mitramite Argentina portal returns a detailed JSON payload when a citizen queries
the status of their DNI (national identity document) processing request. This payload
contains structured data about the current state of the tramite (procedure), the
issuing office, the delivery method, and a timeline of status transitions.

Currently the interceptor captures and forwards raw response bodies, but the overlay
panel only handles `busqueda.php` appointment-slot responses. This feature extends
the system to recognise, parse, and display the tramite-status response — giving
citizens a clear, organised view of where their document is in the process without
needing to inspect raw network traffic.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — View DNI Processing Status at a Glance (Priority: P1)

A citizen visits the Mitramite Argentina portal to check the progress of their DNI
application. The extension intercepts the API response and instantly displays a
structured summary panel showing the document details, current status, and previous
status in plain language.

**Why this priority**: This is the core value of the feature. Without it, the
citizen gains nothing from having the extension installed.

**Independent Test**: Load the extension, navigate to the portal, trigger a tramite
status request. The panel must appear and show: ID tramite, Tipo tramite, Clase
tramite, Tipo DNI, Descripcion tramite, Fecha toma, current status description and
date, and previous status description and date.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** the portal issues a tramite-status
   API request and receives a valid JSON response, **Then** the overlay panel appears
   within 500 ms displaying the parsed tramite information.
2. **Given** the panel is visible, **When** the user reads the Document Info section,
   **Then** they can see ID tramite, Tipo tramite, Clase tramite, Tipo DNI, and
   Descripcion tramite clearly labelled in Spanish.
3. **Given** the panel is visible, **When** the user reads the Status Timeline
   section, **Then** they can see "Último estado" (description + date) and
   "Anteúltimo estado" (description + date) in chronological order.

---

### User Story 2 — View Office and Delivery Details (Priority: P2)

A citizen wants to know which RENAPER office is handling their document and how it
will be delivered to them (postal service, pickup, etc.).

**Why this priority**: Secondary but important — knowing the origin office and
delivery method helps citizens plan to receive their document.

**Independent Test**: With a valid tramite-status response intercepted, the panel's
"Oficina & Retiro" section must display the remittent office name, address, postal
code, province, and the delivery type and postal service.

**Acceptance Scenarios**:

1. **Given** the panel is visible, **When** the user reads the Office section,
   **Then** they see the Oficina remitente with its full name, street address,
   postal code, and Argentine province.
2. **Given** the panel is visible, **When** the user reads the Delivery section,
   **Then** they see Tipo retiro and Correo clearly labelled.

---

### User Story 3 — Graceful Handling of Unknown or Malformed Responses (Priority: P3)

A citizen visits the portal and an API response is captured that does not match the
known tramite-status schema (e.g., it is a busqueda.php slot response, a partial
payload, or an error response).

**Why this priority**: Robustness — the extension must not break or display garbled
data when it encounters responses it does not understand.

**Independent Test**: Feed the interceptor a response without the expected
`data.id_tramite` field. The panel must either show the existing busqueda slot view
(if applicable) or fall back to the raw-text display without crashing.

**Acceptance Scenarios**:

1. **Given** an intercepted response lacks the tramite-status fields, **When** the
   parser processes it, **Then** it does not attempt to render the tramite panel and
   falls back to existing behaviour (slots or raw text).
2. **Given** the API returns `{"codigo": 1, "mensaje": "Error"}`, **When** the panel
   renders, **Then** a user-friendly error message is shown instead of an empty or
   broken panel.

---

### Edge Cases

- What happens when `oficina_remitente` is missing or partially populated?
- How does the panel behave when date fields contain unexpected formats or empty strings?
- What if `tramitesUI` array is present alongside the status fields — does it interfere with parsing?
- How is the panel updated if a second tramite-status response arrives while the panel is already open?
- What happens when `codigo` in the response is non-zero (API-level error)?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST detect when an intercepted API response contains a
  tramite-status payload by checking for the presence of `data.id_tramite` in the
  parsed JSON.
- **FR-002**: The system MUST extract the following fields from the response:
  `id_tramite`, `tipo_tramite`, `clase_tramite`, `tipo_dni`, `descripcion_tramite`,
  `fecha_toma`, `descripcion_ultimo_estado`, `fecha_ultimo_estado`,
  `descripcion_anteultimo_estado`, `fecha_anteultimo_estado`, `tipo_retiro`, `correo`,
  and the nested `oficina_remitente` object (name/description, address, postal code,
  province).
- **FR-003**: The system MUST group extracted fields into logical display sections:
  **Document Info** (ID, type, class, DNI type, description, submission date),
  **Status Timeline** (current status, previous status — each with description and
  date), and **Office & Delivery** (office name, address, postal code, province,
  delivery type, postal service).
- **FR-004**: Within the Status Timeline section, states MUST be ordered with the
  most recent status first.
- **FR-005**: The overlay panel MUST render the tramite-status view when a valid
  tramite-status payload is parsed, replacing any previously shown slot or raw view.
- **FR-006**: The system MUST display a user-readable error notice when the response
  `codigo` field is non-zero or when required fields are missing after parsing.
- **FR-007**: The parser MUST remain backwards-compatible — responses that do not
  match the tramite-status schema MUST continue to be processed by the existing
  appointment-slot parser.
- **FR-008**: All date fields MUST be normalised and displayed in DD/MM/YYYY format
  for consistency with Argentine conventions.

### Key Entities

- **TramiteStatus**: Represents the full parsed state of a DNI processing request.
  Key attributes: id_tramite, tipo_tramite, clase_tramite, tipo_dni,
  descripcion_tramite, fecha_toma, ultimo_estado (description + date),
  anteultimo_estado (description + date), oficina_remitente, tipo_retiro, correo.
- **OficinaRemitente**: Nested entity within TramiteStatus representing the sending
  RENAPER office. Key attributes: descripcion (name), domicilio, codigo_postal,
  provincia.
- **EstadoEntry**: A timestamped status transition. Key attributes: descripcion,
  fecha.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A citizen can read all 13 required fields displayed in the panel
  within 5 seconds of the API response being received, with no need to open
  DevTools or inspect raw JSON.
- **SC-002**: The panel renders the correct grouped layout (3 sections) for 100% of
  valid tramite-status responses encountered during manual and automated testing.
- **SC-003**: Zero regressions in the existing appointment-slot overlay — all
  existing passing tests continue to pass after this feature is implemented.
- **SC-004**: The extension handles malformed or unexpected API responses without
  crashing or displaying empty/broken UI, covering 100% of known edge cases.
- **SC-005**: Date values displayed in the panel are correctly formatted in
  DD/MM/YYYY for 100% of intercepted responses containing date strings.

## Assumptions

- The tramite-status API endpoint will always return a JSON body with a top-level
  `data` object containing `id_tramite` when a valid tramite query is made.
- `oficina_remitente` fields (`descripcion`, `domicilio`, `codigo_postal`,
  `provincia`) may be absent; the UI will show "—" (em-dash) for missing values.
- The extension targets the same Chrome extension architecture as feature 001; no
  new permissions or manifest changes are required beyond what is already declared.
- Spanish-language labels will be used for all displayed field names, consistent
  with the existing overlay panel.

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

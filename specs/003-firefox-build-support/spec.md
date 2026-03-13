# Feature Specification: Firefox Build Support

**Feature Branch**: `003-firefox-build-support`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "add support to build the extension for firefox browser"

## Context

The extension currently builds exclusively for Chrome (Manifest V3). Firefox requires
certain manifest fields (`browser_specific_settings.gecko.id`) to properly identify
the extension, and historically had differences in MV3 support. A developer should be
able to produce a Firefox-compatible distributable package from the same source code
by selecting the build target, without manually editing files or maintaining a separate
source tree.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Build Firefox-compatible Extension Package (Priority: P1)

A developer runs a single build command specifying Firefox as the target and receives
a distributable extension package (zip or directory) that can be loaded directly into
Firefox via `about:debugging` or submitted to addons.mozilla.org.

**Why this priority**: This is the core deliverable of the feature. Without a working
Firefox build, none of the other stories matter.

**Independent Test**: Run the Firefox build command, then manually load the output in
Firefox via `about:debugging → Load Temporary Add-on`. The extension must load
without errors and the overlay panel must appear when triggering a `busqueda.php`
request.

**Acceptance Scenarios**:

1. **Given** the developer is in the project root, **When** they run the Firefox build
   command, **Then** a `dist/` directory is produced containing a manifest that
   Firefox accepts without validation errors.
2. **Given** the Firefox build output, **When** loaded in Firefox as a temporary
   add-on, **Then** the extension activates on `mitramite.renaper.gob.ar` and all
   existing functionality (overlay panel, interceptor, popup) works identically to
   the Chrome version.
3. **Given** a Firefox build and a Chrome build are both produced, **When** comparing
   their source files (JS/CSS), **Then** there is a single shared source — no
   fork or duplication of application logic.

---

### User Story 2 — Select Build Target via Command (Priority: P2)

A developer can build for Chrome or Firefox using distinct, clearly named commands
without editing any configuration files between builds.

**Why this priority**: Supporting both targets from one repo is only practical if
switching targets requires a single command, not manual file edits.

**Independent Test**: Run the Chrome build command; verify output works in Chrome.
Run the Firefox build command; verify output works in Firefox. Confirm no manual
file changes were needed between the two runs.

**Acceptance Scenarios**:

1. **Given** the developer wants a Chrome build, **When** they run the Chrome-specific
   build command, **Then** the output is identical to the current default build.
2. **Given** the developer wants a Firefox build, **When** they run the Firefox-specific
   build command, **Then** the output contains a Firefox-compatible manifest and no
   Chrome-specific fields that would cause Firefox to reject the extension.
3. **Given** both commands exist, **When** a developer reads the `package.json`
   scripts section, **Then** the two targets are clearly distinguishable by name.

---

### User Story 3 — Firefox Package Ready for Distribution (Priority: P3)

A developer can produce a single `.zip` file containing the Firefox extension that
can be submitted to addons.mozilla.org without additional manual steps.

**Why this priority**: Convenient packaging reduces friction for releases; it builds
on top of a working Firefox build (P1 and P2).

**Independent Test**: Run the Firefox package command; verify a `.zip` is produced
whose contents pass `web-ext lint` (or equivalent validation) without errors.

**Acceptance Scenarios**:

1. **Given** a successful Firefox build, **When** the developer runs the package
   command, **Then** a `.zip` file is produced containing exactly the files needed
   for the add-on submission.
2. **Given** the produced `.zip`, **When** validated with a Firefox extension linting
   tool, **Then** no errors are reported (warnings are acceptable).

---

### Edge Cases

- When the build command is run without a `TARGET` env var, it defaults to Chrome,
  preserving existing behaviour for all current invocations.
- How does the build handle the `world: "MAIN"` content script property, which has
  different availability across Firefox versions?
- When both builds are run in sequence, output goes to `dist/chrome/` and `dist/firefox/`
  respectively — they do not overwrite each other.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The build system MUST produce a Firefox-compatible extension artifact
  when invoked with a Firefox-specific build command.
- **FR-002**: The Firefox manifest MUST include the `browser_specific_settings.gecko`
  section with a valid extension ID so Firefox can recognise the add-on.
- **FR-003**: The Firefox build MUST NOT require any changes to shared application
  source files (`src/`) compared to the Chrome build.
- **FR-004**: The build system MUST continue to produce a Chrome-compatible artifact
  via the existing build command, with no change to current Chrome build behaviour.
  When `TARGET` is unset, the build MUST default to Chrome.
- **FR-005**: The two build targets MUST share the same compiled JS/CSS output; only
  the manifest.json MUST differ between targets.
- **FR-006**: The build system MUST write Chrome output to `dist/chrome/` and Firefox
  output to `dist/firefox/` so both targets can coexist and be independently packaged.
- **FR-007**: The build system MUST provide a packaging step that bundles the Firefox
  build into a single `.zip` file ready for distribution.

### Assumptions

- The minimum supported Firefox version is **128** (current ESR as of 2026-03-13).
  `world: "MAIN"` for content scripts was introduced in Firefox 128, so the
  interceptor script requires no adaptation for this target version.
- A single Manifest V3 manifest is sufficient — no MV2 fallback is required.
- The Firefox extension ID follows the format `{uuid}@mitramite-extension` or
  similar; the exact value will be chosen during planning.
- The build system is extended via a `TARGET` environment variable passed to `build.mjs`
  (e.g., `TARGET=firefox node build.mjs`). No new build tooling is introduced for
  compilation; `build.mjs` merges the appropriate manifest and writes to the correct
  `dist/` subdirectory. Packaging (P3) uses a simple `zip` command, not `web-ext`.

### Key Entities

- **Build Target**: A named configuration (Chrome or Firefox) that controls which
  manifest template is used and where output is placed.
- **Manifest Template**: A browser-specific manifest.json (or a shared base with
  per-target overrides) that defines permissions, content scripts, and
  browser-specific metadata.
- **Distribution Package**: A `.zip` archive of the built extension ready for
  browser store submission or manual installation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can go from source code to a loadable Firefox extension in
  one command, with no manual file edits required.
- **SC-002**: The Firefox extension loads in Firefox without errors reported in the
  browser's add-on console.
- **SC-003**: All existing features (overlay panel, slot list, copy button, popup)
  function correctly in Firefox after loading the built extension.
- **SC-004**: The Chrome build command continues to produce an identical artifact to
  the pre-feature baseline — zero regressions for Chrome users.
- **SC-005**: The Firefox distribution `.zip` passes Firefox extension validation
  (zero errors, acceptable warnings only).

## Clarifications

### Session 2026-03-13

- Q: Where should the Firefox build output go (separate dirs vs single dir)? → A: Single `dist/` directory with per-browser subdirectories: `dist/chrome/` and `dist/firefox/`
- Q: How should the Firefox build be produced — extend `build.mjs` or adopt `web-ext`? → A: Extend `build.mjs` with a `TARGET=chrome|firefox` env var; no new build tooling introduced
- Q: What is the minimum Firefox version the extension must support? → A: Firefox 128
- Q: Should `build` with no `TARGET` default to Chrome or error? → A: Default to Chrome (backward-compatible)

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

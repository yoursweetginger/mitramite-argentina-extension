# Tasks: Firefox Build Support

**Input**: Design documents from `/specs/003-firefox-build-support/`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: No new Vitest tests — this feature is build tooling only (`src/` is untouched).
`web-ext lint` (T011) acts as the automated correctness gate for the Firefox output.
Existing test suite must continue to pass unmodified (verified in Polish phase).

**Organization**: Tasks grouped by user story; each story is independently deliverable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks of the same phase
- **[Story]**: [US1] / [US2] / [US3] maps to spec.md user stories

---

## Phase 1: Setup

**Purpose**: Install tooling prerequisite and prepare the workspace for multi-target output.

- [x] T001 Add `web-ext` as a devDependency in `package.json` (`pnpm add -D web-ext`)
- [x] T002 [P] Add `artifacts/` directory to `.gitignore` to exclude packaging output from version control

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Parameterise `build.mjs` with a `TARGET` env var and split output to
`dist/chrome/` and `dist/firefox/`. Must be complete before any user-story phase begins.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [x] T003 Read `process.env.TARGET` in `build.mjs`, default to `"chrome"`, throw with
      a clear error message if the value is not `"chrome"` or `"firefox"` (fail-fast guard)
- [x] T004 Update all three `BuildEntry` objects in `build.mjs` to use
      `` outDir: `dist/${target}` `` instead of the hard-coded `'dist'` string
- [x] T005 Add a manifest-copy step after the Vite build loop in `build.mjs`:
      read `public/manifest.json`, write it verbatim to `dist/${target}/manifest.json`
      (Chrome path — merge logic added in US1)

**Checkpoint**: `node build.mjs` (no TARGET) must produce `dist/chrome/` with the existing
five artifacts plus `manifest.json`. Running `TARGET=firefox node build.mjs` must produce
`dist/firefox/` with the same content (Firefox manifest patch added in US1).

---

## Phase 3: User Story 1 — Build Firefox-compatible Extension Package (Priority: P1) 🎯 MVP

**Goal**: A `TARGET=firefox` build produces `dist/firefox/manifest.json` that Firefox accepts
without errors, containing `browser_specific_settings.gecko.id` and `strict_min_version: "128.0"`.

**Independent Test**: Run `TARGET=firefox node build.mjs`, then load `dist/firefox/manifest.json`
via `about:debugging → Load Temporary Add-on` in Firefox. Extension must activate on
`mitramite.renaper.gob.ar` with the overlay panel working identically to Chrome.

- [x] T006 [US1] Define the Firefox manifest patch constant in `build.mjs`:
      `{ browser_specific_settings: { gecko: { id: "mitramite-argentina@yoursweetginger", strict_min_version: "128.0" } } }`
- [x] T007 [US1] Implement `applyManifestPatch(base, patch)` helper in `build.mjs`
      (single-responsibility deep-merge; no external utility library required)
- [x] T008 [US1] Update the manifest-copy step (T005) in `build.mjs` to call
      `applyManifestPatch` when `target === "firefox"` before writing
      `dist/firefox/manifest.json`

**Checkpoint**: `TARGET=firefox node build.mjs` → `dist/firefox/manifest.json` contains
`browser_specific_settings.gecko`. `TARGET=chrome node build.mjs` → `dist/chrome/manifest.json`
has no `browser_specific_settings` key.

---

## Phase 4: User Story 2 — Select Build Target via Command (Priority: P2)

**Goal**: Developers select Chrome or Firefox via distinct npm scripts without editing any files.
Existing `build` script behaviour is fully preserved.

**Independent Test**: Run `pnpm build:chrome`; verify `dist/chrome/`. Run `pnpm build:firefox`;
verify `dist/firefox/`. Run `pnpm build`; verify `dist/chrome/` identical to `pnpm build:chrome`.
No manual file edits needed between the three runs.

- [x] T009 [P] [US2] Add `"build:chrome": "TARGET=chrome node build.mjs"` script to `package.json`
- [x] T010 [P] [US2] Add `"build:firefox": "TARGET=firefox node build.mjs"` script to `package.json`
- [x] T011 [US2] Update the existing `"build"` script in `package.json` to
      `"TARGET=chrome node build.mjs"` (makes the default explicit; output is now `dist/chrome/`)

**Checkpoint**: All three scripts succeed. `package.json` scripts section clearly differentiates
the two targets. Running `pnpm build && pnpm build:firefox` produces both `dist/chrome/` and
`dist/firefox/` without either overwriting the other.

---

## Phase 5: User Story 3 — Firefox Package Ready for Distribution (Priority: P3)

**Goal**: A single `pnpm package:firefox` command produces a submission-ready `.zip` at
`artifacts/firefox/` that passes `web-ext lint` with zero errors.

**Independent Test**: Run `pnpm build:firefox && pnpm lint:firefox`; verify zero errors.
Run `pnpm package:firefox`; verify a `.zip` is produced at `artifacts/firefox/`.

- [x] T012 [P] [US3] Add `"lint:firefox": "web-ext lint --source-dir dist/firefox"` script
      to `package.json`
- [x] T013 [P] [US3] Add `"package:firefox": "web-ext build --source-dir dist/firefox --artifacts-dir artifacts/firefox --overwrite-dest"` script to `package.json`

**Checkpoint**: `pnpm build:firefox && pnpm lint:firefox` exits zero. `pnpm package:firefox`
produces `artifacts/firefox/mitramite_argentina_extension-0.1.0.zip`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Update downstream references that assumed a flat `dist/` output; verify existing
tests are unaffected.

- [x] T014 [P] Update the existing `dev` script in `package.json` to reflect new outDir
      (`"dev": "TARGET=chrome node build.mjs && vite build --watch"`) so watch mode targets
      `dist/chrome/`
- [x] T015 [P] Update `README.md` or any inline comments in `build.mjs` that reference
      the old flat `dist/` output path to reference `dist/<target>/`
- [x] T016 Run `pnpm test:run` and confirm all existing Vitest tests pass unmodified
      (source files in `src/` are untouched; this is a regression gate only)
- [x] T017 Run `pnpm build && pnpm build:firefox` end-to-end; confirm `dist/chrome/` and
      `dist/firefox/` are both present and structurally identical except for `manifest.json`

---

## Dependencies

```
T001 (web-ext) ──────────────────────────────→ T012, T013 (US3 scripts)
T002 (gitignore) ────────────────────────────→ (unblocks T013 output)

T003 (TARGET var) ───┐
T004 (outDir split) ─┤──→ T005 (manifest copy) ──→ T006 → T007 → T008 (US1)
                     │                                              ↓
                     └──→ T009, T010, T011 (US2 scripts) ──────────→ US3
```

**User story completion order**: Phase 1 → Phase 2 → US1 (P1) → US2 (P2) → US3 (P3) → Polish

---

## Parallel Execution Examples

### Fastest single-developer path (MVP = US1 + US2)

```sh
# Phase 1 (both in parallel)
pnpm add -D web-ext &
echo "artifacts/" >> .gitignore

# Phase 2 (sequential — foundational)
# edit build.mjs: T003, T004, T005

# Phase 3 US1 (sequential in build.mjs)
# T006 → T007 → T008

# Phase 4 US2 (T009 and T010 in parallel, then T011)
# edit package.json: T009 + T010 together, then T011
```

### After MVP — add US3

```sh
# T012 and T013 can be written together in one package.json edit
```

---

## Implementation Strategy

| Scope  | Stories | Deliverable                                                  |
| ------ | ------- | ------------------------------------------------------------ |
| MVP    | US1+US2 | Working Firefox build selectable by command; no manual edits |
| Full   | +US3    | Submission-ready `.zip` from a single command                |
| Polish | —       | Clean outDir references; regression verification             |

**Suggested MVP cut**: Complete through Phase 4 (T001–T011). This satisfies the two
highest-priority stories and lets the developer load the extension in Firefox immediately.
US3 (packaging) adds the `.zip` convenience but is not required for functional validation.

---

## Task Count Summary

| Phase        | Stories | Count  |
| ------------ | ------- | ------ |
| Setup        | —       | 2      |
| Foundational | —       | 3      |
| US1 (P1)     | US1     | 3      |
| US2 (P2)     | US2     | 3      |
| US3 (P3)     | US3     | 2      |
| Polish       | —       | 4      |
| **Total**    |         | **17** |

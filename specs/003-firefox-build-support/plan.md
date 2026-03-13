# Implementation Plan: Firefox Build Support

**Branch**: `003-firefox-build-support` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-firefox-build-support/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extend `build.mjs` and `package.json` to support a `TARGET` environment variable
(`chrome` | `firefox`) that selects the output directory (`dist/chrome/` or
`dist/firefox/`) and merges a Firefox-specific manifest patch
(`browser_specific_settings.gecko`) at build time. A single shared source tree
produces both distributables; no application logic is duplicated. A `package:firefox`
script invokes `web-ext build` to produce a submission-ready `.zip`. The default
(no `TARGET`) builds for Chrome, preserving all current invocation patterns.

## Technical Context

**Language/Version**: TypeScript 5.5 (strict mode); Node.js ESM (build script)
**Primary Dependencies**: Vite 5, `@vitejs/plugin-react`; new dev dep: `web-ext` (Mozilla's
official packaging/linting CLI)
**Storage**: N/A
**Testing**: Vitest 2.x (no new tests needed — this feature is build tooling only; existing
tests continue to pass unmodified)
**Target Platform**: Chrome MV3 (existing) + Firefox MV3 (new); `world: "MAIN"` requires
Firefox ≥128 → `strict_min_version: "128.0"` set in Firefox manifest patch
**Project Type**: Browser extension (build toolchain extension)
**Performance Goals**: Build-time only; no runtime performance impact; bundle size unchanged
**Constraints**: No fork/duplication of application logic; Chrome default preserved; Firefox
manifest must include `browser_specific_settings.gecko.id` and `strict_min_version: "128.0"`;
output dirs must not overwrite each other (`dist/chrome/` vs `dist/firefox/`)
**Scale/Scope**: Single developer workflow; two build targets; one shared source tree

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Per `.specify/memory/constitution.md` v1.0.0, verify the following before proceeding:

- [x] **Code Quality**: Changes are confined to `build.mjs` and `package.json`
      (build tooling). A helper function `applyManifestPatch` handles the single
      responsibility of merging Firefox-specific fields. `web-ext` is the only new
      dependency; it is explicitly justified (Mozilla's official packaging/linting
      CLI with no transitive runtime impact on the extension bundle). Zero-warning
      ESLint policy applies to `build.mjs`.
- [x] **Testing Standards**: This feature involves no new application logic paths;
      all production code (`src/`) is unchanged. Existing unit tests continue to
      cover ≥80% of source. A smoke-test step (`web-ext lint`) acts as the
      automated gate for the Firefox build output. No new Vitest tests are required
      because the build script itself is not testable via Vitest (it is a Node.js
      CLI script), but the `lint` script ensures correctness of the output.
- [x] **UX Consistency**: No VS Code commands are introduced; this is a developer
      CLI workflow only. New npm scripts (`build:chrome`, `build:firefox`,
      `package:firefox`) are clearly named. No raw errors are surfaced to end users.
- [x] **Performance**: No change to the extension activation path or bundle size.
      `web-ext` is a dev dependency and is not included in the extension bundle.
      Build time increases slightly (two manifest writes) but this is dev-tool time,
      not user-facing performance.

_Post-Phase 1 re-check_: All gates remain green after design. No violations.

> No gate violations detected. Complexity Tracking table is omitted.

## Project Structure

### Documentation (this feature)

```text
specs/003-firefox-build-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── build-commands.md
│   └── manifest-firefox.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
build.mjs                    # Extend: TARGET env var, per-target outDir, manifest patch step
package.json                 # Extend: add build:chrome, build:firefox, lint:firefox, package:firefox scripts
public/
└── manifest.json            # Unchanged (Chrome base; Firefox fields merged at build time)

artifacts/                   # NEW: .zip outputs from web-ext build (git-ignored)
└── firefox/
    └── mitramite_argentina_extension-0.1.0.zip
```

**Structure Decision**: Single project. All changes are purely additive to existing
build tooling. No new top-level source directories. The `src/` tree is untouched.
Output directories change from a flat `dist/` to `dist/chrome/` and `dist/firefox/`
to prevent mutual overwrite between targets.

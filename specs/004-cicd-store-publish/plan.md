# Implementation Plan: CI/CD Pipeline with Store Publishing

**Branch**: `004-cicd-store-publish` | **Date**: 2026-03-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-cicd-store-publish/spec.md`

## Summary

Implement three GitHub Actions workflows that automate the extension development
lifecycle: a CI quality gate on every PR (tests + lint), an artifact build on
every merge to `main`, and a full release pipeline triggered by a `vX.Y.Z` tag
that injects the version into `manifest.json`, builds both Chrome and Firefox
packages, and publishes them independently to the Chrome Web Store and Firefox
Add-ons Store via their respective OAuth2 / JWT APIs.

## Technical Context

**Language/Version**: YAML (GitHub Actions), Bash (inline steps), Node.js 20 LTS  
**Primary Dependencies**: GitHub Actions (`ubuntu-latest`), `pnpm` v9, `web-ext` v10 (already a `devDependency`), Chrome Web Store Upload API v1.1, Firefox AMO API v5 (via `web-ext sign`), `jq` (pre-installed on runners)  
**Storage**: GitHub Actions artifact storage (90-day retention); no new persistent storage  
**Testing**: Existing `pnpm test:run` (Vitest) — no new test code for this feature  
**Target Platform**: GitHub Actions `ubuntu-latest` runners  
**Project Type**: CI/CD pipeline configuration (3 workflow YAML files)  
**Performance Goals**: CI (test + lint) completes in <5 min per PR (SC-001); full release from tag push to both store submissions in <10 min (SC-003)  
**Constraints**: Zero secrets in logs or artifacts (FR-007); Firefox and Chrome publish jobs fully independent (FR-008); tag format strictly `vX.Y.Z` (FR-011)  
**Scale/Scope**: 3 workflow files, 6 GitHub repository secrets, no changes to `src/` or `tests/`

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Per `.specify/memory/constitution.md` v1.0.0, verify the following before proceeding:

- [x] **Code Quality**: This feature introduces no new TypeScript/JavaScript code.
      The deliverables are YAML pipeline files and documentation. The single-responsibility
      principle is satisfied by separating CI, build, and release into three distinct
      workflow files. No new npm dependencies are introduced (R-02: `web-ext` already
      present; R-03: `curl`/`jq` are runner built-ins).
- [x] **Testing Standards**: No new production code paths — no new tests required.
      The pipeline itself runs the existing test suite (`pnpm test:run`) as the CI
      quality gate, maintaining the ≥80% coverage enforcement.
- [x] **UX Consistency**: No new extension commands or UI elements. N/A.
- [x] **Performance**: No changes to extension activation path. No new runtime
      dependencies added to the extension bundle. VSIX/package size unaffected. N/A.

## Project Structure

### Documentation (this feature)

```text
specs/004-cicd-store-publish/
├── plan.md              # This file
├── research.md          # Phase 0 output — 8 decisions covering platform, tools, patterns
├── data-model.md        # Phase 1 output — workflow, job, artifact, secret entities
├── quickstart.md        # Phase 1 output — operator setup guide + release procedure
├── contracts/
│   ├── workflow-triggers.md   # Trigger events, output contracts, job dependency graph
│   └── secrets-interface.md   # All 6 secrets: names, sources, injection patterns
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml           # PR quality gate: test + lint jobs (trigger: pull_request → main)
    ├── build.yml        # Artifact build on merge: Chrome + Firefox (trigger: push → main)
    └── release.yml      # Release pipeline: validate-tag → build → publish (trigger: push vX.Y.Z)

public/
└── manifest.json        # Version field patched by release.yml before build (no code change)
```

**Structure Decision**: Single-project layout. All new files are in
`.github/workflows/`. Zero changes to `src/`, `tests/`, or `build.mjs`.
The only existing file touched at runtime is `public/manifest.json`
(version injected ephemerally within the runner; the committed file is unchanged).

## Complexity Tracking

> No constitution violations — table omitted.

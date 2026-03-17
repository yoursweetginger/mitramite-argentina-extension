# Tasks: CI/CD Pipeline with Store Publishing

**Input**: Design documents from `/specs/004-cicd-store-publish/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to ([US1]–[US4])
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `.github/workflows/` directory and establish the pnpm
environment step snippet that is shared across all three workflow files.

- [x] T001 Create `.github/workflows/` directory (if not already present)
- [x] T002 Verify pnpm lockfile is committed and `pnpm install --frozen-lockfile` works locally — no file change needed, just validation step before authoring workflows

**Checkpoint**: Directory exists; pnpm environment confirmed reproducible

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The three artifacts below are prerequisites referenced by all four
user stories. The `ci.yml` PR gate (US1) must exist before merges can produce
the build artifacts that US2 depends on. Tag validation in `release.yml` blocks
all publishing stories.

_No foundational tasks — each workflow file is independently deliverable per
user story. Proceed directly to Phase 3._

---

## Phase 3: User Story 1 — Automated Quality Gate on Every PR (Priority: P1) 🎯 MVP

**Goal**: Run `pnpm test:run` and `pnpm lint && pnpm typecheck` on every PR
targeting `main`, reporting pass/fail status checks that block merge on failure.

**Independent Test**: Open a PR, verify the `CI — Tests & Lint` workflow fires,
two status checks appear (`test`, `lint`), and a deliberately broken test
causes the `test` check to fail and blocks merge.

- [x] T003 [US1] Create `.github/workflows/ci.yml` with `pull_request` trigger targeting `main`
- [x] T004 [US1] Add `test` job to `.github/workflows/ci.yml`: checkout → pnpm setup → `pnpm install --frozen-lockfile` → `pnpm test:run`
- [x] T005 [US1] Add `lint` job to `.github/workflows/ci.yml`: checkout → pnpm setup → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck`
- [x] T006 [US1] Configure branch protection on `main` to require `test` and `lint` status checks (documented in quickstart.md — operator action, not a file change)

**Checkpoint**: Push a PR — `CI — Tests & Lint` workflow runs; both checks appear
on the PR; a failing test blocks merge; fixing it unblocks merge.

---

## Phase 4: User Story 2 — Automated Build and Artifact Creation on Merge (Priority: P2)

**Goal**: On every push to `main`, produce a Chrome `.zip` and a Firefox `.zip`
and upload both as downloadable GitHub Actions artifacts.

**Independent Test**: Merge a PR to `main`; verify `Build — Extension Artifacts`
workflow completes with two artifacts (`chrome-extension`, `firefox-extension`)
downloadable from the Actions run page.

- [x] T007 [US2] Create `.github/workflows/build.yml` with `push` trigger on `main` branch
- [x] T008 [P] [US2] Add `build-chrome` job to `.github/workflows/build.yml`: checkout → pnpm setup → `pnpm install --frozen-lockfile` → `pnpm build:chrome` → `mkdir -p artifacts/chrome` → `cd dist/chrome && zip -r ../../artifacts/chrome/extension.zip .` → `actions/upload-artifact@v4` (name: `chrome-extension`)
- [x] T009 [P] [US2] Add `build-firefox` job to `.github/workflows/build.yml`: checkout → pnpm setup → `pnpm install --frozen-lockfile` → `pnpm build:firefox` → `pnpm package:firefox` → `actions/upload-artifact@v4` (name: `firefox-extension`, path: `artifacts/firefox/`)

**Checkpoint**: Merge a commit to `main`; both `chrome-extension` and
`firefox-extension` artifacts appear in the `Build — Extension Artifacts` run.

---

## Phase 5: User Story 3 — Automated Publishing to Firefox Add-ons Store (Priority: P3)

**Goal**: On a `vX.Y.Z` tag push, inject the version into `manifest.json`,
build the Firefox package, and publish it to AMO automatically using stored
JWT credentials.

**Independent Test**: Create and push a `v0.9.0-test` tag (or actual `v0.1.0`),
verify the `publish-firefox` job completes successfully and the AMO developer
dashboard shows the new version submitted for review. Verify `AMO_JWT_ISSUER`
missing causes a clear `::error::` failure with no partial submission.

- [x] T010 [US3] Create `.github/workflows/release.yml` with `push` trigger on `v*.*.*` tags
- [x] T011 [US3] Add `validate-tag` job to `.github/workflows/release.yml`: `grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'` check on `GITHUB_REF_NAME`; emit `::error::` and `exit 1` on mismatch
- [x] T012 [US3] Add `build-firefox` job to `.github/workflows/release.yml` with `needs: validate-tag`: checkout → pnpm setup → extract version from `GITHUB_REF_NAME` via `echo "VERSION=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT` → `jq` patch of `public/manifest.json` → `pnpm build:firefox` → `pnpm package:firefox` → `actions/upload-artifact@v4` (name: `firefox-extension-release`)
- [x] T013 [US3] Add `publish-firefox` job to `.github/workflows/release.yml` with `needs: build-firefox`: `actions/download-artifact@v4` → validate `AMO_JWT_ISSUER`/`AMO_JWT_SECRET` are non-empty with `::error::` on failure → `pnpm web-ext sign --channel=listed --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET" --source-dir=dist/firefox --artifacts-dir=signed-firefox --no-input` → detect version-already-exists exit code and treat as success

**Checkpoint**: Push a `v0.1.0` tag; `validate-tag` passes; `build-firefox`
produces a versioned Firefox zip; `publish-firefox` submits to AMO and the
run is marked green. AMO dashboard shows version `0.1.0` awaiting review.

---

## Phase 6: User Story 4 — Automated Publishing to Chrome Web Store (Priority: P4)

**Goal**: On the same `vX.Y.Z` tag push, inject the version, build the Chrome
package, and publish it to the Chrome Web Store via OAuth2 `curl` calls without
any third-party actions.

**Independent Test**: After tagging, verify `publish-chrome` job completes
independently of `publish-firefox`, Chrome Web Store dashboard shows the new
version submitted for review. Verify missing `CHROME_CLIENT_ID` emits a clear
error and exits 1.

- [x] T014 [US4] Add `build-chrome` job to `.github/workflows/release.yml` with `needs: validate-tag` (independent of `build-firefox`): checkout → pnpm setup → extract version → `jq` patch of `public/manifest.json` → `pnpm build:chrome` → `mkdir -p artifacts/chrome` → `cd dist/chrome && zip -r ../../artifacts/chrome/extension.zip .` → `actions/upload-artifact@v4` (name: `chrome-extension-release`)
- [x] T015 [US4] Add `publish-chrome` job to `.github/workflows/release.yml` with `needs: build-chrome` (NOT dependent on `publish-firefox`): `actions/download-artifact@v4` → validate all four Chrome secrets are non-empty → exchange `CHROME_REFRESH_TOKEN` for access token via `curl` POST to `https://oauth2.googleapis.com/token` → upload zip via `curl PUT` to Chrome Web Store Upload API → detect HTTP 409 (already submitted) and exit 0 → `curl POST` publish endpoint → log summary link

**Checkpoint**: Same `vX.Y.Z` tag run — `publish-chrome` and `publish-firefox`
run independently; a simulated failure of one does NOT cancel the other;
Chrome Web Store dashboard shows the same version submitted for review.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Harden the workflows, verify secrets safety, and document operator setup.

- [x] T016 [P] Audit all three workflow files to confirm no secret values can appear in `run:` output — add `set +x` guards to any step that references `${{ secrets.* }}` variables
- [x] T017 [P] Add `concurrency:` group to `release.yml` to prevent parallel tag runs from racing on the same version (group: `release-${{ github.ref }}`, cancel-in-progress: false)
- [x] T018 [P] Pin all third-party action versions to full SHA digests (`actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`) for supply-chain security
- [x] T019 Add `permissions:` block to each workflow file, scoping to minimum required (`contents: read` for CI/build; `contents: read` for release — no write permissions needed)
- [ ] T020 Validate the completed workflows against the quickstart.md acceptance scenarios by performing a manual end-to-end dry-run (push a test PR, merge it, push a test tag)

**Checkpoint**: All three workflows pass a full end-to-end test; no secrets appear
in logs; re-running the same tag exits 0 without re-submitting.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately (T001–T002)
- **Phase 3 (US1 CI)**: Depends on Phase 1 — must complete before any PRs get status checks
- **Phase 4 (US2 Build)**: Independent of Phase 3 — can start after Phase 1
- **Phase 5 (US3 Firefox)**: Independent of Phase 3 and 4 — `release.yml` is a new file
- **Phase 6 (US4 Chrome)**: T014–T015 are additions to the same `release.yml` started in Phase 5 — must sequence after T010–T013
- **Phase 7 (Polish)**: Depends on all four story phases complete

### User Story Dependencies

```
T001–T002 (Setup)
    │
    ├─► T003–T006  (US1 ci.yml)        ← independently testable via PR
    │
    ├─► T007–T009  (US2 build.yml)     ← independently testable via merge
    │
    └─► T010–T013  (US3 release.yml, Firefox half)
              │
              └─► T014–T015  (US4 release.yml, Chrome half — same file, sequential)
```

- US3 and US4 share `.github/workflows/release.yml` — T014 (adding `build-chrome`
  job) and T015 (adding `publish-chrome` job) MUST be authored after T010–T013
  create the file, but the resulting **runtime** jobs are fully independent.

### Parallel Opportunities Within Phases

- **Phase 4**: T008 (`build-chrome` job) and T009 (`build-firefox` job) can be
  written in parallel (different job blocks in the same file) if two developers
  are working simultaneously.
- **Phase 7**: T016, T017, T018 are independent polish tasks on different
  concerns — all three can be done in parallel.

---

## Parallel Example: User Story 2 (Build Workflow)

```bash
# Developer A: Chrome build job (T008)
# Developer B: Firefox build job (T009)
# Both edit build.yml simultaneously in different job blocks — no conflict
git checkout -b task/T008-build-chrome-job
git checkout -b task/T009-build-firefox-job
```

---

## Implementation Strategy

**MVP Scope**: User Story 1 (T001–T006) — delivers immediate value by protecting
`main` from broken code on every PR. No secrets, no external APIs required.

**Increment 2**: User Story 2 (T007–T009) — adds artifact storage, confirming
builds are reproducible on every merge.

**Increment 3**: User Stories 3 + 4 (T010–T015) — full release automation.
Requires one-time secret setup (see `quickstart.md`).

**Final**: Phase 7 polish (T016–T020) — supply-chain hardening, concurrency
protection, full end-to-end validation.

---

## Total Task Count

| Phase                     | User Story | Tasks         | Notes        |
| ------------------------- | ---------- | ------------- | ------------ |
| Phase 1 — Setup           | —          | T001–T002     | 2 tasks      |
| Phase 3 — CI Gate         | US1 (P1)   | T003–T006     | 4 tasks      |
| Phase 4 — Build Artifacts | US2 (P2)   | T007–T009     | 3 tasks      |
| Phase 5 — Firefox Publish | US3 (P3)   | T010–T013     | 4 tasks      |
| Phase 6 — Chrome Publish  | US4 (P4)   | T014–T015     | 2 tasks      |
| Phase 7 — Polish          | —          | T016–T020     | 5 tasks      |
| **Total**                 |            | **T001–T020** | **20 tasks** |

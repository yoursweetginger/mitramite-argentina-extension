# Feature Specification: CI/CD Pipeline with Store Publishing

**Feature Branch**: `004-cicd-store-publish`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "create cicd for the application. test, build, push, publish to firefox addons store and chrome extension store"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Automated Quality Gate on Every Pull Request (Priority: P1)

A developer pushes code to a branch or opens a pull request. The pipeline automatically runs all tests and reports pass/fail status back to the developer and the pull request, preventing broken code from being merged.

**Why this priority**: Automated testing is the foundation of all CI/CD value. It protects the codebase from regressions and is useful independently even without the publishing pipeline.

**Independent Test**: Can be fully tested by pushing a commit to a feature branch and verifying that a test run is triggered, results are reported in the pull request status check, and a failing test blocks merging.

**Acceptance Scenarios**:

1. **Given** a developer opens a pull request, **When** the pipeline runs, **Then** all unit tests are executed and the result is posted as a required status check on the PR.
2. **Given** a test fails, **When** the pipeline reports results, **Then** the PR is marked as failing and cannot be merged until the check passes.
3. **Given** all tests pass, **When** the pipeline reports results, **Then** the PR is marked as passing and the developer is unblocked.

---

### User Story 2 - Automated Build and Artifact Creation on Merge (Priority: P2)

When a pull request is merged to the main branch, the pipeline automatically builds both the Chrome and Firefox extension packages and stores them as downloadable artifacts tied to that commit.

**Why this priority**: Automating the build ensures every merge produces a reproducible, versioned artifact without manual steps, which is the prerequisite for automated publishing.

**Independent Test**: Can be fully tested by merging a PR and verifying that both a Chrome `.zip` and a Firefox `.xpi`/`.zip` artifact appear in the pipeline run's artifact storage.

**Acceptance Scenarios**:

1. **Given** a PR is merged to the main branch, **When** the pipeline runs the build job, **Then** a Chrome-compatible extension package is produced and uploaded as a build artifact.
2. **Given** a PR is merged to the main branch, **When** the pipeline runs the build job, **Then** a Firefox-compatible extension package is produced and uploaded as a build artifact.
3. **Given** the build fails for any reason, **When** the pipeline reports results, **Then** the build job is marked as failed and no publishing step is attempted.

---

### User Story 3 - Automated Publishing to Firefox Add-ons Store (Priority: P3)

When a developer creates and pushes a version tag, the pipeline publishes the Firefox extension package to the Firefox Add-ons Store (addons.mozilla.org) automatically, using stored credentials.

**Why this priority**: Automated publishing to Firefox eliminates manual upload steps and reduces time-to-release. It builds on the artifact produced in Story 2.

**Independent Test**: Can be fully tested by creating a version tag on the main branch and verifying that the Firefox Add-ons Store dashboard shows the new version submitted for review.

**Acceptance Scenarios**:

1. **Given** a version tag is pushed to the main branch, **When** the publishing pipeline runs, **Then** the Firefox extension package is submitted to the Firefox Add-ons Store using stored API credentials.
2. **Given** the submission succeeds, **When** the pipeline completes, **Then** the pipeline run is marked as successful and a summary link to the submission is logged.
3. **Given** the API credentials are missing or invalid, **When** the publishing pipeline runs, **Then** the job fails with a clear error message and no partial submission is made.

---

### User Story 4 - Automated Publishing to Chrome Web Store (Priority: P4)

When a developer creates and pushes a version tag, the pipeline publishes the Chrome extension package to the Chrome Web Store automatically, using stored credentials.

**Why this priority**: Automated Chrome publishing mirrors the Firefox flow and completes the dual-store release pipeline. It has the same value proposition but is slightly lower priority since Firefox Add-ons Store review can take longer and is the higher-friction path.

**Independent Test**: Can be fully tested by creating a version tag and verifying the Chrome Web Store developer dashboard shows the new version submitted for review.

**Acceptance Scenarios**:

1. **Given** a version tag is pushed to the main branch, **When** the publishing pipeline runs, **Then** the Chrome extension package is uploaded to the Chrome Web Store using stored OAuth credentials.
2. **Given** the submission succeeds, **When** the pipeline completes, **Then** the pipeline run is marked as successful and a summary link to the submission is logged.
3. **Given** the API credentials are missing or invalid, **When** the publishing pipeline runs, **Then** the job fails with a clear error message and no partial upload is made.

---

### Edge Cases

- What happens when publishing to one store succeeds but the other fails? Each store's publishing job MUST be independent so a failure in one does not prevent the other from completing.
- What happens when a version tag is pushed but the build artifacts are unavailable? The publishing jobs MUST fail gracefully with a clear error rather than uploading corrupted or empty packages.
- What happens when the pipeline is triggered multiple times for the same tag (e.g., reruns)? Publishing jobs MUST be idempotent or detect an already-submitted version and skip re-submission without failing.
- What happens if secrets (API credentials) are rotated? The pipeline MUST use environment-level secret references so credentials can be updated without modifying pipeline configuration files.
- What happens if a tag does not follow the `vX.Y.Z` format? The pipeline MUST reject the tag with a clear error before any build or publish step runs.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The pipeline MUST automatically run all unit tests for every pull request opened or updated against the main branch.
- **FR-002**: The pipeline MUST report test results as a required status check on each pull request, blocking merge on failure.
- **FR-003**: The pipeline MUST build both the Chrome and Firefox extension packages on every successful merge to the main branch.
- **FR-004**: The pipeline MUST upload the built extension packages as downloadable artifacts tied to the pipeline run.
- **FR-004b**: When a version tag is pushed, the pipeline MUST perform a fresh build from the tagged commit (with the injected version in `manifest.json`), independently of any earlier merge build artifacts, before publishing to the stores.
- **FR-005**: The pipeline MUST automatically publish the Firefox extension package to the Firefox Add-ons Store when a version tag is pushed to the main branch, without requiring any manual approval step.
- **FR-006**: The pipeline MUST automatically publish the Chrome extension package to the Chrome Web Store when a version tag is pushed to the main branch, without requiring any manual approval step.
- **FR-007**: All credentials and secrets (API keys, OAuth tokens) MUST be stored as encrypted secrets in the pipeline environment and never written to logs or artifacts.
- **FR-008**: Publishing jobs for Firefox and Chrome MUST run independently so a failure in one does not block the other.
- **FR-009**: The pipeline MUST produce a clear, human-readable failure message when any job fails, including which step failed and why.
- **FR-010**: The pipeline MUST be triggered only from the main/default branch for publishing steps, never from feature branches.
- **FR-011**: When a version tag is pushed, the pipeline MUST automatically extract the version number from the tag (e.g., `v1.2.3` → `1.2.3`) and write it into `manifest.json` before building the extension packages, ensuring the tag and published version always match.
- **FR-012**: The pipeline MUST rely solely on GitHub Actions run status and GitHub's built-in failure email notifications for reporting outcomes; no external notification channels (Slack, webhooks, etc.) are required.

### Key Entities

- **Pipeline Run**: A single execution of the automated pipeline, tied to a commit or tag, with status (pass/fail) and downloadable artifacts.
- **Extension Package**: A distributable archive (one per target browser) produced by the build step, containing all extension assets.
- **Version Tag**: A git tag in the format `vX.Y.Z` that signals a release and triggers the publishing pipeline.
- **Pipeline Secret**: An encrypted credential stored in the pipeline environment (e.g., Firefox API key, Chrome OAuth token) referenced by name in the pipeline configuration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every pull request receives automated test results within 5 minutes of being opened or updated, with no manual steps required.
- **SC-002**: 100% of merges to the main branch produce both a Chrome and a Firefox extension artifact automatically, with no manual build steps.
- **SC-003**: A new release can be published to both stores by a single git tag push, reducing the release process to under 10 minutes of human effort.
- **SC-004**: Zero secrets or credentials appear in pipeline logs or downloadable artifacts across all runs.
- **SC-005**: A failure in the Firefox publishing step does not prevent the Chrome publishing step from completing, and vice versa.
- **SC-006**: All pipeline steps produce actionable failure messages that allow a developer to diagnose and fix the issue without consulting a pipeline expert.

## Clarifications

### Session 2026-03-13

- Q: Which CI/CD platform should the pipeline use? → A: GitHub Actions
- Q: Should publishing to stores require a manual approval gate after tagging? → A: Fully automatic — tag push triggers store submission directly with no human gate
- Q: Should the pipeline auto-inject the git tag version into `manifest.json` before building? → A: Automatic injection — pipeline extracts version from the tag and writes it into `manifest.json` before building the packages
- Q: Should the release pipeline re-build from the tag or re-use merge artifacts? → A: Fresh build from tag — release pipeline builds both packages from scratch at the tagged commit (with injected version)
- Q: Should the pipeline send external notifications on publish success/failure? → A: GitHub Actions run status only — no external notifications; default GitHub email on failure is sufficient

## Assumptions

- The pipeline is implemented using **GitHub Actions** (`.github/workflows/` YAML files), leveraging its native integration with the existing GitHub repository for secret storage, PR status checks, and artifact storage.
- Version tagging follows the `vX.Y.Z` semantic versioning convention.
- Firefox Add-ons Store and Chrome Web Store both expose programmatic submission APIs that can be called from a pipeline environment.
- The project already has a working local build for both browsers (confirmed by the existing `pnpm build` and `pnpm package:firefox` scripts).
- The existing test suite (`pnpm test`) is stable and suitable for use as the CI quality gate without modification to test code.

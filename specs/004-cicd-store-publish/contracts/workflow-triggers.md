# Contract: Workflow Triggers

**Phase**: 1 | **Branch**: `004-cicd-store-publish` | **Date**: 2026-03-13

This document defines the trigger interfaces — the precise events that activate
each GitHub Actions workflow and the implicit contracts between them.

---

## Workflow: `ci.yml` — CI Quality Gate

### Trigger Contract

| Field                | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| Event                | `pull_request`                                        |
| Activity types       | `opened`, `synchronize`, `reopened` (GitHub defaults) |
| Target branch filter | `main`                                                |

**Implicit contract**: Every PR opened against `main` MUST receive a required
status check named `test` (and `lint`) before merge is permitted. The repository
branch protection rule MUST list these check names as required.

### Output Contract

| Output              | Description                                                                  |
| ------------------- | ---------------------------------------------------------------------------- |
| Status check `test` | Pass = all `pnpm test:run` tests green; Fail = at least one test failed      |
| Status check `lint` | Pass = zero ESLint warnings + TypeScript no errors; Fail = any warning/error |

No artifacts are uploaded by this workflow.

---

## Workflow: `build.yml` — Artifact Build on Merge

### Trigger Contract

| Field         | Value  |
| ------------- | ------ |
| Event         | `push` |
| Branch filter | `main` |

**Implicit contract**: Fires exactly once per commit pushed to `main`
(including squash-merges from PRs). Does NOT use release secrets; no publishing
step is invoked.

### Output Contract

| Artifact Name       | Contents                                     | Retention |
| ------------------- | -------------------------------------------- | --------- |
| `chrome-extension`  | `extension.zip` — flat zip of `dist/chrome/` | 90 days   |
| `firefox-extension` | `*.zip` — output of `pnpm package:firefox`   | 90 days   |

---

## Workflow: `release.yml` — Release Build & Publish

### Trigger Contract

| Field      | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| Event      | `push`                                                                |
| Tag filter | `v*.*.*` (glob; the `validate-tag` job enforces exact `vX.Y.Z` regex) |

**Implied constraint**: Tag MUST be pushed from the `main` branch commit history.
Pushing a tag pointing to a non-`main` commit is not blocked at the workflow
trigger level but SHOULD be enforced by team convention (enforced via
branch protection + documented in `quickstart.md`).

### Job Dependency Contract

```
validate-tag (fails fast on bad tag format)
    │
    ├─► build-chrome  (version injected, zip produced)
    │         │
    │         └─► publish-chrome  (Chrome Web Store API)
    │
    └─► build-firefox (version injected, pnpm package:firefox)
              │
              └─► publish-firefox (web-ext sign --channel=listed)
```

**Independence contract**: `publish-chrome` and `publish-firefox` have separate
`needs:` directives and are NOT in each other's dependency chain. A failure in
`publish-chrome` MUST NOT cancel `publish-firefox` and vice versa. This is
guaranteed by GitHub Actions' default job isolation behavior.

### Output Contract

| Artifact Name               | Contents                                        |
| --------------------------- | ----------------------------------------------- |
| `chrome-extension-release`  | `extension.zip` — versioned Chrome build        |
| `firefox-extension-release` | `*.zip` — versioned Firefox build (pre-signing) |

Publishing steps consume the artifact zip files; both are also uploaded to
GitHub Actions for audit purposes.

---

## Shared Step Contract: pnpm Environment Setup

Each workflow job that runs `pnpm` commands MUST include these steps in order:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
```

Deviation from this sequence (e.g., omitting `--frozen-lockfile`) is a violation
of this contract and must be treated as a bug.

---

## Secret Injection Contract

Secrets are injected at the job level via `env:` blocks and referenced as
`${{ secrets.SECRET_NAME }}`. They must never appear in any of the following:

- `run:` step `echo` or `print` statements
- Artifact file contents
- Step outputs (`GITHUB_OUTPUT`)
- Workflow `::debug::` or `::notice::` annotations

The only acceptable usage is as direct arguments to CLI tools (`--api-key`,
OAuth token header value) within the same `run:` step that consumes them.

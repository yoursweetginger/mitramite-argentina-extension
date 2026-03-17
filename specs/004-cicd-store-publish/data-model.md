# Data Model: CI/CD Pipeline with Store Publishing

**Phase**: 1 | **Branch**: `004-cicd-store-publish` | **Date**: 2026-03-13

This feature introduces no new runtime extension code. All entities are
**CI/CD configuration constructs** living in `.github/workflows/` YAML files
and the secrets configuration of the GitHub repository.

---

## Entity: WorkflowFile

A GitHub Actions YAML configuration file that defines one pipeline.

| Field     | Type              | Value / Source                 | Notes                             |
| --------- | ----------------- | ------------------------------ | --------------------------------- |
| `path`    | `string`          | `.github/workflows/<name>.yml` | Relative to repo root             |
| `name`    | `string`          | Human-readable pipeline name   | Shown in GitHub Actions UI        |
| `trigger` | `WorkflowTrigger` | See below                      | Determines when the workflow runs |
| `jobs`    | `Job[]`           | See job definitions            | Independent units of work         |

**Three workflow files for this feature:**

| File          | `name`                        | Trigger                         |
| ------------- | ----------------------------- | ------------------------------- |
| `ci.yml`      | `CI — Tests & Lint`           | `pull_request` targeting `main` |
| `build.yml`   | `Build — Extension Artifacts` | `push` to `main` branch         |
| `release.yml` | `Release — Build & Publish`   | `push` matching `v*.*.*` tags   |

---

## Entity: WorkflowTrigger

Defines the GitHub event(s) that activate a workflow.

### CI trigger (`ci.yml`)

```yaml
on:
  pull_request:
    branches: [main]
```

### Build trigger (`build.yml`)

```yaml
on:
  push:
    branches: [main]
```

### Release trigger (`release.yml`)

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
```

**Validation**: The release workflow's first job (`validate-tag`) applies a strict
`^v[0-9]+\.[0-9]+\.[0-9]+$` regex check to `GITHUB_REF_NAME` to reject
pre-release or malformed tags before any build or publish work begins.

---

## Entity: Job

A unit of work within a workflow, running on a single runner instance.

| Field     | Type                    | Notes                                        |
| --------- | ----------------------- | -------------------------------------------- |
| `id`      | `string`                | Snake-case identifier (e.g., `build-chrome`) |
| `runs-on` | `string`                | `ubuntu-latest` for all jobs in this feature |
| `needs`   | `string[]`              | Upstream jobs that must succeed first        |
| `steps`   | `Step[]`                | Ordered list of commands and actions         |
| `env`     | `Record<string,string>` | Job-level env vars (secrets injected here)   |

**Dependency graph for `release.yml`:**

```
validate-tag
    ├─► build-chrome ──► publish-chrome
    └─► build-firefox ─► publish-firefox
```

`publish-chrome` and `publish-firefox` have no dependency on each other,
satisfying FR-008 (independent failure modes).

---

## Entity: ExtensionArtifact

A built extension package uploaded to GitHub Actions artifact storage.

| Field            | Type     | Notes                                                     |
| ---------------- | -------- | --------------------------------------------------------- |
| `name`           | `string` | Human-readable artifact name (e.g., `chrome-extension`)   |
| `path`           | `string` | File path inside the runner (uploaded from this location) |
| `format`         | `"zip"`  | Both Chrome and Firefox artifacts are `.zip` files        |
| `retention-days` | `number` | Default: 90 days (GitHub Actions default)                 |

**Chrome artifact**: produced by `zip -r artifacts/chrome/extension.zip .`  
**Firefox artifact**: produced by `pnpm package:firefox` →
`artifacts/firefox/*.zip`

Both artifacts are uploaded via `actions/upload-artifact@v4`.

---

## Entity: VersionTag

A Git tag in `vX.Y.Z` format that triggers the release pipeline.

| Field     | Type     | Constraint                               | Notes                                     |
| --------- | -------- | ---------------------------------------- | ----------------------------------------- |
| `ref`     | `string` | Must match `^v[0-9]+\.[0-9]+\.[0-9]+$`   | Available as `GITHUB_REF_NAME` in runners |
| `version` | `string` | Derived: `ref` with leading `v` stripped | Written into `public/manifest.json`       |

**State transitions**:

```
git tag pushed → validate-tag (regex check) → extract version → inject into manifest.json → build
```

**Validation rules**:

- Tags NOT matching `vX.Y.Z` MUST cause `validate-tag` job to fail with
  `::error::` annotation before any build step executes.
- Pre-release tags like `v1.0.0-beta` are rejected by the regex.

---

## Entity: PipelineSecret

An encrypted credential stored at GitHub repository scope, referenced by name
in workflow YAML. Secrets are never written to logs or artifact files (FR-007).

| Secret Name            | Required By                     | Description                      |
| ---------------------- | ------------------------------- | -------------------------------- |
| `AMO_JWT_ISSUER`       | `release.yml` / publish-firefox | Firefox AMO API key (JWT issuer) |
| `AMO_JWT_SECRET`       | `release.yml` / publish-firefox | Firefox AMO API secret           |
| `CHROME_CLIENT_ID`     | `release.yml` / publish-chrome  | Google OAuth2 client ID          |
| `CHROME_CLIENT_SECRET` | `release.yml` / publish-chrome  | Google OAuth2 client secret      |
| `CHROME_REFRESH_TOKEN` | `release.yml` / publish-chrome  | Google OAuth2 refresh token      |
| `CHROME_EXTENSION_ID`  | `release.yml` / publish-chrome  | Chrome Web Store item ID         |

**Validation rules**:

- All six secrets MUST be set before a release tag is pushed.
- If any secret is absent in the publishing job, the API call fails with
  a clear HTTP error; the job catches this and exits 1 with a descriptive message.
- Secrets MUST NOT be echo'd, printed with `set -x`, or embedded in artifact files.

---

## Entity: ArtifactNamingScheme

Naming convention for uploaded artifacts across workflow runs.

| Artifact                             | Upload Name                 | File Name                  |
| ------------------------------------ | --------------------------- | -------------------------- |
| Chrome build (from `build.yml`)      | `chrome-extension`          | `extension.zip`            |
| Firefox build (from `build.yml`)     | `firefox-extension`         | `*.zip` (web-ext filename) |
| Chrome release (from `release.yml`)  | `chrome-extension-release`  | `extension.zip`            |
| Firefox release (from `release.yml`) | `firefox-extension-release` | `*.zip`                    |

Release artifacts use a separate name so they do not shadow the per-merge
build artifacts in the GitHub Actions UI.

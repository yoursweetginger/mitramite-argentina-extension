# Research: CI/CD Pipeline with Store Publishing

**Phase**: 0 | **Branch**: `004-cicd-store-publish` | **Date**: 2026-03-13

---

## R-01 — CI/CD Platform Selection

**Question**: Which CI/CD platform should the pipeline be built on?

**Decision**: GitHub Actions (`.github/workflows/` YAML files).

**Rationale**: Confirmed explicitly in the spec clarifications. GitHub Actions
provides native integration with the existing GitHub repository for secret storage,
PR status checks, and artifact storage — no additional service accounts or external
CI services are needed. The repository owner already has access.

**Alternatives considered**:

- _CircleCI, Travis CI_: Require additional account setup and secret management
  outside GitHub. Rejected.
- _GitLab CI, Bitbucket Pipelines_: Not applicable — project is hosted on GitHub.

---

## R-02 — Firefox Add-ons Store Publishing Tool

**Question**: Which tool should the pipeline use to publish to the Firefox
Add-ons Store (AMO)?

**Decision**: Use `web-ext sign --channel=listed` with `--api-key` and
`--api-secret` flags, pointing at `dist/firefox/` after the Firefox build.

**Rationale**: `web-ext` (v10) is already a `devDependency` in `package.json`.
The `web-ext sign` command supports `--channel=listed` for public AMO submission
and accepts JWT credentials (`AMO_JWT_ISSUER` / `AMO_JWT_SECRET`) available from
the Firefox developer hub at https://addons.mozilla.org/en-US/developers/addon/api/key/.
This eliminates any additional npm install in CI and requires zero new dependencies.

Command used in CI:

```bash
pnpm web-ext sign \
  --channel=listed \
  --api-key="${AMO_JWT_ISSUER}" \
  --api-secret="${AMO_JWT_SECRET}" \
  --source-dir=dist/firefox \
  --artifacts-dir=signed-firefox \
  --no-input
```

**Idempotency**: The AMO API sets the add-on version from the submitted
`manifest.json`. If the same version is re-submitted, AMO returns an error
indicating a version conflict; the pipeline job MUST be written to treat
this as a no-op and exit 0 to satisfy FR requirement for idempotent re-runs.
Implementation: wrap the sign command and parse exit code / stderr for
`"version already exists"` / HTTP 409.

**Alternatives considered**:

- _Direct AMO Upload API (raw curl)_: More control but requires more boilerplate
  for JWT generation. Rejected — `web-ext` already handles auth, retry, and
  artifact download.
- _`mozilla/addons-server` GitHub Action_: Not officially maintained as a
  general-purpose GitHub Action. Rejected.

---

## R-03 — Chrome Web Store Publishing Tool

**Question**: Which tool/approach should the pipeline use to publish to the
Chrome Web Store?

**Decision**: Use direct `curl` calls to the Chrome Web Store Upload API (v1.1),
authenticated via an OAuth2 refresh token exchange. No third-party GitHub Action
is introduced (zero new dependencies).

**Rationale**: The Chrome Web Store API is a simple two-call REST workflow:

1. Exchange `CHROME_REFRESH_TOKEN` for a short-lived access token via Google
   OAuth2 (`https://oauth2.googleapis.com/token`).
2. Upload the zip with `PUT https://www.googleapis.com/upload/chromewebstore/v1.1/items/{id}`.
3. Publish with `POST .../items/{id}/publish`.

`curl` and `jq` are both pre-installed on `ubuntu-latest` GitHub Actions runners.
This avoids pinning a third-party action whose maintenance status is uncertain.

OAuth2 setup steps (done once by the operator):

1. Create a Google Cloud project, enable the Chrome Web Store API.
2. Create OAuth2 credentials (`installed` app type), obtain `client_id` and
   `client_secret`.
3. Generate a `refresh_token` using the OAuth2 playground
   (scope: `https://www.googleapis.com/auth/chromewebstore`).
4. Store `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`,
   and `CHROME_EXTENSION_ID` as GitHub repository secrets.

**Idempotency**: The Chrome Web Store API returns HTTP 409 when the same package
version is already pending review. The pipeline step MUST detect this response
code and exit 0 (skip re-submission gracefully).

**Alternatives considered**:

- _`trmcnvn/upload-chrome-extension` action_: Encapsulates the same API calls
  but introduces a third-party dependency. Rejected per constitution Principle I
  (external dependencies must be explicitly justified; prefer minimal-footprint).
- _`plasmo-hq/bpp` action_: Broad scope, overkill. Rejected.

---

## R-04 — Version Injection Strategy

**Question**: How should the pipeline inject the tag version into `manifest.json`
before building?

**Decision**: Use `jq` in a bash step to in-place-edit `public/manifest.json`,
then proceed with the normal build scripts.

```bash
VERSION="${GITHUB_REF_NAME#v}"   # strips leading 'v', e.g. "1.2.3"
jq --arg v "$VERSION" '.version = $v' public/manifest.json > public/manifest.tmp.json
mv public/manifest.tmp.json public/manifest.json
```

`jq` is pre-installed on `ubuntu-latest`. Using env output (`GITHUB_OUTPUT`) to
carry the extracted version across steps:

```yaml
- name: Extract version
  id: version
  run: echo "VERSION=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT
```

**Rationale**: `build.mjs` copies `public/manifest.json` into `dist/<target>/`
(confirmed by reading `build.mjs` lines 95–105). Patching the source file before
`node build.mjs` runs ensures the injected version propagates into both the Chrome
and Firefox manifests without touching build scripts. `jq` is the idiomatic
tool for JSON manipulation in CI shell steps.

**Alternatives considered**:

- _Pass version via env var and modify `build.mjs`_: Requires touching production
  build code. Rejected.
- _`sed` regex on manifest.json_: Fragile with JSON formatting changes. Rejected.
- _`node -e` inline script_: Works but less readable than `jq`. Rejected.

---

## R-05 — Workflow File Structure

**Question**: How many GitHub Actions workflow files are needed, and what are
their trigger conditions?

**Decision**: Three workflow files.

| File                            | Trigger                         | Jobs                                                                                 |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`      | `pull_request` targeting `main` | `test`, `lint`                                                                       |
| `.github/workflows/build.yml`   | `push` to `main` branch         | `build` (Chrome + Firefox)                                                           |
| `.github/workflows/release.yml` | `push` of `v*.*.*` tags         | `validate-tag`, `build-chrome`, `build-firefox`, `publish-firefox`, `publish-chrome` |

**Rationale**:

- Separating `ci.yml` from `build.yml` ensures PRs get fast feedback (test + lint
  only) without triggering expensive artifact builds.
- `build.yml` runs on merge to main and produces artifacts for manual download
  (FR-003, FR-004). These artifacts are independent of the release artifacts.
- `release.yml` is tag-triggered (`vX.Y.Z`) and always performs a fresh build
  with version injection (FR-004b), completely independent of the merge-build
  artifacts (per spec clarification).
- `publish-firefox` and `publish-chrome` jobs in `release.yml` have independent
  `needs` arrays (`needs: build-firefox` and `needs: build-chrome` respectively)
  so a failure in one does not block the other (FR-008).

**Alternatives considered**:

- _Single workflow with conditional logic_: Complex `if:` expressions make the
  file hard to read and maintain. Rejected.
- _Two workflows (ci + release)_: Would require duplicating the lint/test logic
  inside the release workflow to satisfy FR-001. Rejected.

---

## R-06 — pnpm Setup in GitHub Actions

**Question**: How should pnpm be installed and dependencies cached on CI runners?

**Decision**: Use the official `pnpm/action-setup@v4` action followed by
`actions/setup-node@v4` with `cache: 'pnpm'`.

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'
- run: pnpm install --frozen-lockfile
```

`--frozen-lockfile` ensures reproducible installs (fails if `pnpm-lock.yaml` is
out of sync), preventing silent dependency drift in CI.

**Node version rationale**: Node 20 LTS is the current active LTS line and is
compatible with all existing `devDependencies` (TypeScript 5.5, Vite 5, Vitest 2,
web-ext 10).

**Alternatives considered**:

- _`npm ci`_: Project uses pnpm; switching tools would invalidate the lock file.
  Rejected.
- _Node 18_: Older LTS; web-ext 10 and Vite 5 both recommend Node 20+. Rejected.

---

## R-07 — Tag Format Validation

**Question**: How should the pipeline validate that a pushed tag matches `vX.Y.Z`
before proceeding?

**Decision**: Validate with a shell `grep -qE` pattern at the start of the
`validate-tag` job; emit `::error::` and exit 1 on mismatch.

```bash
if ! echo "$GITHUB_REF_NAME" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "::error::Tag '$GITHUB_REF_NAME' does not match required format vX.Y.Z"
  exit 1
fi
```

This fires before any build or publish step, satisfying the edge-case requirement
that an invalid tag is rejected early with a clear message.

**Alternatives considered**:

- _Trigger filter `tags: ['v[0-9]+.[0-9]+.[0-9]+']` only_: GitHub tag glob syntax
  doesn't support full regex; `v*.*.* ` would also match `v1.2.3-beta`. Rejected
  as insufficient for exact enforcement.
- _A separate validation action_: Over-engineering a one-liner check. Rejected.

---

## R-08 — Chrome Extension Artifact Packaging

**Question**: How should the Chrome extension be packaged into a zip for upload?

**Decision**: After `pnpm build:chrome`, run `cd dist/chrome && zip -r ../../artifacts/chrome/extension.zip .` to produce a flat zip suitable for the Chrome Web Store Upload API.

The Chrome Web Store API requires a `.zip` file containing the extension directory
contents (not the directory itself). The `cd && zip .` pattern achieves this.

**Alternatives considered**:

- _`web-ext build --target=chromium`_: `web-ext` supports Chromium target but
  produces its own output path; using it would introduce inconsistency with the
  Firefox workflow. Rejected — `zip` is simpler and more transparent.

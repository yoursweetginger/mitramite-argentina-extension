# Quickstart: CI/CD Pipeline with Store Publishing

**Phase**: 1 | **Branch**: `004-cicd-store-publish` | **Date**: 2026-03-13

This guide explains how to set up the pipeline from scratch, how to trigger each
workflow, and what to expect from a release run.

---

## Prerequisites

- Admin access to the GitHub repository (to add secrets and configure branch
  protection).
- A Firefox developer account at `https://addons.mozilla.org/`.
- A Google account with access to the Chrome Web Store developer dashboard for
  the extension.
- A Google Cloud project with the Chrome Web Store API enabled.

---

## One-Time Setup

### 1. Configure Firefox AMO Credentials

1. Log in to `https://addons.mozilla.org/en-US/developers/`.
2. Navigate to **Tools → Manage API Keys**.
3. Click **Generate new credentials**.
4. Copy the **JWT issuer** (looks like `user:12345:123`) and **JWT secret**.
5. In your GitHub repository, go to **Settings → Secrets and variables → Actions**.
6. Create:
   - `AMO_JWT_ISSUER` = the JWT issuer value
   - `AMO_JWT_SECRET` = the JWT secret value

### 2. Configure Chrome Web Store Credentials

**2a. Enable the API and create OAuth credentials:**

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Go to **APIs & Services → Library**, search for "Chrome Web Store API", enable it.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
5. Select **Desktop app** as the application type.
6. Download or copy the **Client ID** and **Client secret**.

**2b. Generate a refresh token:**

1. Open `https://developers.google.com/oauthplayground`.
2. Click the settings gear (⚙) and check **Use your own OAuth credentials**.
3. Enter your Client ID and Client secret.
4. In Step 1, search for `chromewebstore` and select:
   `https://www.googleapis.com/auth/chromewebstore`
5. Click **Authorize APIs**, complete sign-in.
6. In Step 2, click **Exchange authorization code for tokens**.
7. Copy the **Refresh token** value.

**2c. Find your extension ID:**
Open your extension in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
The item ID is the 32-character string in the URL.

**2d. Add secrets to GitHub:**

- `CHROME_CLIENT_ID` = OAuth client ID
- `CHROME_CLIENT_SECRET` = OAuth client secret
- `CHROME_REFRESH_TOKEN` = the refresh token from 2b
- `CHROME_EXTENSION_ID` = the 32-char item ID

### 3. Configure Branch Protection

In your GitHub repository, go to **Settings → Branches → Add rule** for `main`:

- Enable **Require status checks to pass before merging**.
- Add the following required checks:
  - `test` (from `ci.yml`)
  - `lint` (from `ci.yml`)
- Enable **Require a pull request before merging**.

---

## Daily Development Workflow

### Opening a Pull Request → CI runs automatically

1. Push your feature branch.
2. Open a PR targeting `main`.
3. The `CI — Tests & Lint` workflow fires automatically.
4. Two status checks appear on the PR: `test` and `lint`.
5. Fix any failures; the checks re-run on each new push to the PR.
6. Merging is blocked until both checks pass.

### Merging to `main` → Build artifacts produced automatically

1. Merge the PR (or push directly to `main`).
2. The `Build — Extension Artifacts` workflow fires.
3. Two artifacts appear in the Actions run: `chrome-extension` and
   `firefox-extension`.
4. Download from **Actions → the workflow run → Artifacts**.

---

## Releasing a New Version

### Step-by-step

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Verify tests pass locally
pnpm test:run

# 3. Create and push a version tag (must match vX.Y.Z exactly)
git tag v1.2.3
git push origin v1.2.3
```

### What happens next (automatically)

| Step                                                   | Job               | Duration (est.) |
| ------------------------------------------------------ | ----------------- | --------------- |
| Tag format validated                                   | `validate-tag`    | <30 s           |
| Version injected into manifest, Chrome build produced  | `build-chrome`    | ~2 min          |
| Version injected into manifest, Firefox build produced | `build-firefox`   | ~2 min          |
| Chrome zip uploaded to Chrome Web Store                | `publish-chrome`  | ~1 min          |
| Firefox zip submitted to AMO                           | `publish-firefox` | ~1 min          |

Total elapsed: ≈5–7 minutes from tag push to both submissions.

### Checking results

- Open the Actions tab in GitHub, find the `Release — Build & Publish` run.
- Each job shows green ✓ on success.
- On AMO: check `https://addons.mozilla.org/en-US/developers/` → your extension →
  the new version appears with status "Awaiting Review".
- On Chrome Web Store: check your developer dashboard — the new version appears
  with status "Pending Review".

---

## Handling Failures

### Tag rejected (bad format)

```
::error::Tag 'v1.2.3-beta' does not match required format vX.Y.Z
```

**Fix**: Delete the tag (`git tag -d v1.2.3-beta && git push origin :refs/tags/v1.2.3-beta`),
push a correctly formatted tag.

### Secret missing or invalid

```
::error::AMO_JWT_ISSUER is empty — set it in GitHub repository secrets
```

**Fix**: Add or update the secret in **Settings → Secrets and variables → Actions**.
Re-run the failed job from the Actions UI (no need to push a new tag).

### Version already submitted (idempotent re-run)

Both `publish-firefox` and `publish-chrome` detect this condition and exit 0,
so pipeline re-runs against the same tag are safe.

---

## Local Build Reference

These local commands mirror what CI does:

```bash
# Run all tests
pnpm test:run

# Lint and type-check
pnpm lint
pnpm typecheck

# Build Chrome extension
pnpm build:chrome          # output: dist/chrome/

# Build Firefox extension
pnpm build:firefox         # output: dist/firefox/

# Package Firefox extension
pnpm package:firefox       # output: artifacts/firefox/*.zip

# Package Chrome extension (manual)
mkdir -p artifacts/chrome
cd dist/chrome && zip -r ../../artifacts/chrome/extension.zip . && cd -
```

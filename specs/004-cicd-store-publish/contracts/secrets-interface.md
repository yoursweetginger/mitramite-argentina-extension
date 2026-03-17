# Contract: Secrets Interface

**Phase**: 1 | **Branch**: `004-cicd-store-publish` | **Date**: 2026-03-13

This document defines the complete secrets interface — the names, types, sources,
and usage contracts for all encrypted credentials required by the CI/CD pipeline.

---

## Firefox Add-ons Store Secrets

These credentials are obtained from the Firefox developer hub:
`https://addons.mozilla.org/en-US/developers/addon/api/key/`

| GitHub Secret Name | Type     | Description                                        | Consumed By                           |
| ------------------ | -------- | -------------------------------------------------- | ------------------------------------- |
| `AMO_JWT_ISSUER`   | `string` | JWT issuer / API key (looks like `user:12345:123`) | `release.yml` → `publish-firefox` job |
| `AMO_JWT_SECRET`   | `string` | JWT secret / API secret (long hex string)          | `release.yml` → `publish-firefox` job |

**Injection pattern**:

```yaml
env:
  AMO_JWT_ISSUER: ${{ secrets.AMO_JWT_ISSUER }}
  AMO_JWT_SECRET: ${{ secrets.AMO_JWT_SECRET }}
```

**CLI usage**:

```bash
pnpm web-ext sign \
  --channel=listed \
  --api-key="$AMO_JWT_ISSUER" \
  --api-secret="$AMO_JWT_SECRET" \
  --source-dir=dist/firefox \
  --artifacts-dir=signed-firefox \
  --no-input
```

---

## Chrome Web Store Secrets

**Step 1 — Enable the Chrome Web Store API in Google Cloud**

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and sign
   in with the Google account that owns the extension.
2. In the project picker at the top, create a new project (e.g.
   `mitramite-extension`) or select an existing one.
3. Open **APIs & Services → Library**, search for **"Chrome Web Store API"**, and
   click **Enable**.

**Step 2 — Create an OAuth 2.0 client credential**

1. Go to **APIs & Services → Credentials → + Create Credentials → OAuth client
   ID**.
2. If prompted to configure the OAuth consent screen, choose **External**, fill
   in the app name and your email, and save. You do **not** need to submit for
   verification — the app only needs to work for your own account.
   After saving, scroll down to **Test users** and add the Google account email
   you will use to authorize the Playground in Step 3. Without this, the OAuth
   flow will fail with `Error 403: access_denied` because Testing-mode apps
   block all accounts that are not explicitly listed.
3. Back in Create OAuth client ID, select **Web application** as the application
   type. Give it a name (e.g. `CWS publish`).
   > Do **not** choose "Desktop app" — Desktop app clients have hard-coded
   > redirect URIs (`http://localhost` only) and cannot be used with the OAuth
   > Playground. A Web application client is required so you can authorize the
   > Playground's callback URL. The refresh token it produces works identically
   > in the CI/CD `curl` calls.
4. Under **Authorized redirect URIs**, click **+ Add URI** and enter:
   ```
   https://developers.google.com/oauthplayground
   ```
5. Click **Create**. Copy the **Client ID** and **Client Secret** that appear —
   these become `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET`.

**Step 3 — Generate a long-lived refresh token via OAuth 2.0 Playground**

1. Open [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. Click the gear icon (⚙ **Settings**, top-right) and check
   **"Use your own OAuth credentials"**.
3. Enter the **Client ID** and **Client Secret** from Step 2. Close the settings
   panel.
4. In the left-hand **Step 1** box, paste the scope:
   ```
   https://www.googleapis.com/auth/chromewebstore
   ```
   then click **Authorize APIs**.
5. Sign in with the same Google account that manages the extension on the Chrome
   Web Store. Grant access when prompted.
6. You are returned to Step 2: click **"Exchange authorization code for tokens"**.
7. Copy the **Refresh token** value — this becomes `CHROME_REFRESH_TOKEN`.
   > The refresh token does not expire unless you revoke it or change your
   > Google account password. Store it securely.

**Step 4 — Find the extension's item ID**

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
2. Select the extension. The item ID is the 32-character lowercase string in the
   page URL after `/detail/` — e.g. `abcdefghijklmnopabcdefghijklmnop`.
   This becomes `CHROME_EXTENSION_ID`.
   > If the extension has never been published, you must upload an initial package
   > manually through the dashboard first so that a permanent item ID is assigned.

| GitHub Secret Name     | Type     | Description                                  | Consumed By                          |
| ---------------------- | -------- | -------------------------------------------- | ------------------------------------ |
| `CHROME_CLIENT_ID`     | `string` | Google OAuth2 client ID                      | `release.yml` → `publish-chrome` job |
| `CHROME_CLIENT_SECRET` | `string` | Google OAuth2 client secret                  | `release.yml` → `publish-chrome` job |
| `CHROME_REFRESH_TOKEN` | `string` | Long-lived OAuth2 refresh token              | `release.yml` → `publish-chrome` job |
| `CHROME_EXTENSION_ID`  | `string` | Chrome Web Store item ID (32-char lowercase) | `release.yml` → `publish-chrome` job |

**Injection pattern**:

```yaml
env:
  CHROME_CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
  CHROME_CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
  CHROME_REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
  CHROME_EXTENSION_ID: ${{ secrets.CHROME_EXTENSION_ID }}
```

**Usage pattern** (in publish-chrome job):

```bash
# Step 1: Exchange refresh token for short-lived access token
ACCESS_TOKEN=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -d "client_id=${CHROME_CLIENT_ID}" \
  -d "client_secret=${CHROME_CLIENT_SECRET}" \
  -d "refresh_token=${CHROME_REFRESH_TOKEN}" \
  -d "grant_type=refresh_token" \
  | jq -r '.access_token')

# Step 2: Upload the zip
HTTP_STATUS=$(curl -s -o /tmp/upload_response.json -w "%{http_code}" \
  -X PUT \
  "https://www.googleapis.com/upload/chromewebstore/v1.1/items/${CHROME_EXTENSION_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-api-version: 2" \
  -T artifacts/chrome/extension.zip)

# Step 3: Handle idempotency (409 = same version already exists)
if [ "$HTTP_STATUS" = "409" ]; then
  echo "Version already submitted; skipping re-upload."
  exit 0
fi

# Step 4: Publish
curl -s -X POST \
  "https://www.googleapis.com/chromewebstore/v1.1/items/${CHROME_EXTENSION_ID}/publish" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-api-version: 2" \
  -H "Content-Length: 0"
```

---

## Secret Absence Failure Contract

If any required secret is absent:

- `web-ext sign` exits non-zero with `"apiKey is required"` or equivalent.
- The Chrome OAuth token exchange returns HTTP 400/401; the pipeline step
  detects the non-2xx response and exits 1 with a clear error message.

In both cases the job MUST print a human-readable explanation (e.g.,
`"::error::AMO_JWT_ISSUER is empty — set it in GitHub repository secrets"`)
before exiting 1, satisfying FR-009.

---

## Secret Rotation Contract

All secrets are referenced by name. When credentials are rotated:

1. Update the value in GitHub repository → Settings → Secrets and variables →
   Actions.
2. No changes to any workflow file are required.
3. The next pipeline run picks up the new value automatically.

This satisfies the edge-case requirement: "pipeline MUST use environment-level
secret references so credentials can be updated without modifying pipeline
configuration files."

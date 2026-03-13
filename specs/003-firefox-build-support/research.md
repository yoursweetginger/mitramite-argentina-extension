# Research: Firefox Build Support

**Phase**: 0 | **Branch**: `003-firefox-build-support` | **Date**: 2026-03-13

---

## R-01 — Firefox MV3 `world: "MAIN"` Support

**Question**: The current `interceptor` content script uses `"world": "MAIN"`.
Does Firefox MV3 support this, and from which version?

**Decision**: Retain `"world": "MAIN"` in the Firefox manifest without modification.
Set `strict_min_version: "128.0"` in `browser_specific_settings.gecko`.

**Rationale**: Firefox 128 (released June 2024) added full support for
`"world": "MAIN"` in Manifest V3 content scripts
(see [MDN content_scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_scripts)).
The interceptor relies on running in the page's JavaScript scope to intercept
`XMLHttpRequest` — this is exactly the use case `world: "MAIN"` is designed for.
Targeting Firefox ≥128 is an acceptable constraint since it is the current ESR
(Firefox ESR 128.x).

**Alternatives considered**:

- _Remove `world` key for Firefox_: Would cause the content script to run in the
  isolated world, breaking XHR interception. Rejected.
- _Use a polyfill / message-passing workaround for older Firefox_: Adds complexity
  and a second code path. Rejected because Firefox ESR 128 is the current baseline.

---

## R-02 — Firefox-Required Manifest Fields

**Question**: What manifest fields must be added or present for a Firefox MV3
extension to load without errors and be submittable to AMO?

**Decision**: Merge the following Firefox patch into the base `manifest.json`
at build time, writing the result to `dist/firefox/manifest.json`:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "mitramite-argentina@yoursweetginger",
      "strict_min_version": "128.0"
    }
  }
}
```

**Rationale**:

- `browser_specific_settings.gecko.id` is required by Firefox to associate the
  extension with a stable identity; without it, persistent storage and some APIs
  behave inconsistently, and AMO rejects the submission.
- `strict_min_version: "128.0"` is required because `world: "MAIN"` is only
  available from Firefox 128.
- No other base-manifest fields cause Firefox to reject MV3 extensions. Chrome-only
  keys (e.g., `world` itself) are tolerated by Firefox when the feature is supported.

**Alternatives considered**:

- _Maintain two separate manifest files_: Causes duplication of all shared fields.
  Rejected in favour of a merge/patch approach (single source of truth).
- _Use a Vite/Rollup plugin for manifest generation_: Adds an npm dependency for
  a task that a five-line `Object.assign` in `build.mjs` handles. Rejected.

---

## R-03 — Build Target Parameterisation Strategy

**Question**: How should the build be parameterised to support both Chrome and
Firefox from a single invocation path without duplicating Vite config?

**Decision**: Use a `TARGET` environment variable (values: `chrome` | `firefox`).
The existing `build.mjs` reads `process.env.TARGET` (defaulting to `"chrome"`) and:

1. Sets `outDir` to `dist/${TARGET}` for all three Vite build entries.
2. After the Vite builds complete, writes the merged `manifest.json` to
   `dist/${TARGET}/manifest.json` (Chrome: copy as-is; Firefox: deep-merge patch).

**Rationale**:

- Single script, minimal diff, no new Vite plugins.
- The default (`TARGET` unset) produces `dist/chrome/` output, preserving backwards
  compatibility for all existing invocations (`node build.mjs`, `npm run build`).
- Keeping `build.mjs` as the single build entry point avoids fragmenting the
  build logic across multiple files.

**Alternatives considered**:

- _Separate `build.chrome.mjs` and `build.firefox.mjs`_: Duplicates the entry
  loop. Rejected.
- _Vite plugin (e.g., `vite-plugin-web-extension`)_: Replaces the existing custom
  build script with a third-party abstraction. Adds a significant dependency and
  learning curve for a two-manifest use case. Rejected.

---

## R-04 — Firefox Packaging & Linting Tool

**Question**: What tool should be used to produce the submission-ready `.zip` and
to validate the extension?

**Decision**: Add `web-ext` as a dev dependency. Use `web-ext lint` for validation
and `web-ext build` for packaging.

**Rationale**:

- `web-ext` is Mozilla's official CLI; `web-ext lint` is the authoritative
  validator referenced by AMO submission guidelines.
- `web-ext build` produces a correctly-structured `.zip` identical to what AMO
  expects (excludes hidden files, correctly handles file ordering).
- Running via a devDependency (rather than `npx`) ensures reproducible output
  in CI without relying on network availability at build time.

**web-ext commands**:

```sh
# Validate Firefox build output
npx web-ext lint --source-dir dist/firefox

# Produce submission zip → artifacts/firefox/
npx web-ext build --source-dir dist/firefox --artifacts-dir artifacts/firefox --overwrite-dest
```

**Alternatives considered**:

- _Manual `zip` command_: Already used in the project (`zip -r mitramite-extension.zip dist/`)
  but does not validate the manifest or exclude unwanted files. Rejected for packaging;
  acceptable as a quick workaround.
- _addons-linter (standalone)_: `web-ext lint` wraps `addons-linter` internally,
  so using `web-ext` is the recommended surface. Rejected as redundant.

---

## R-05 — Output Directory Layout Change

**Question**: The spec requires `dist/chrome/` and `dist/firefox/` to not overwrite
each other. What is the cleanest migration path from the current flat `dist/`?

**Decision**: Change `outDir` in every `build.mjs` entry from `'dist'` to
`` `dist/${target}` `` where `target = process.env.TARGET ?? 'chrome'`.

**Impact on existing usage**:

- `npm run build` → `dist/chrome/` (not `dist/`). Any downstream scripts that
  reference `dist/` (e.g., the existing `zip -r mitramite-extension.zip dist/`)
  must be updated to `dist/chrome/`.
- `package.json` should expose `package:chrome` (zip `dist/chrome/`) and
  `package:firefox` (`web-ext build --source-dir dist/firefox`) scripts.

**Rationale**: Prevents a Firefox build from partially overwriting a Chrome build
when both happen in the same workspace (as required by the spec edge case).

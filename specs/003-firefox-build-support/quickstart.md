# Quickstart: Firefox Build Support

**Feature**: `003-firefox-build-support` | **Updated**: 2026-03-13

---

## Prerequisites

- Node.js ≥18, pnpm installed
- Dependencies installed: `pnpm install`
- `web-ext` will be available as a devDependency after implementation

---

## Build for Chrome (unchanged behaviour)

```sh
pnpm build
# shorthand for TARGET=chrome, outputs → dist/chrome/
```

Or explicitly:

```sh
pnpm build:chrome
```

---

## Build for Firefox

```sh
pnpm build:firefox
# outputs → dist/firefox/
```

The Firefox build is identical to the Chrome build in JS/CSS content. The only
difference is `dist/firefox/manifest.json`, which includes:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "mitramite-argentina@yoursweetginger",
    "strict_min_version": "128.0"
  }
}
```

---

## Load in Firefox for Testing

1. Open Firefox and navigate to `about:debugging`
2. Click **"This Firefox"** in the left sidebar
3. Click **"Load Temporary Add-on…"**
4. Select `dist/firefox/manifest.json`
5. Navigate to `*://mitramite.renaper.gob.ar/*` and trigger a `busqueda.php`
   request — the overlay panel should appear as it does in Chrome

---

## Validate the Firefox Build

```sh
pnpm lint:firefox
# runs: web-ext lint --source-dir dist/firefox
```

Expected: no ERROR-level diagnostics. Warnings are acceptable.

---

## Build Both Targets in Sequence

```sh
pnpm build:chrome && pnpm build:firefox
```

Output:

```
dist/
├── chrome/   ← Chrome build
└── firefox/  ← Firefox build
```

The two directories are independent; running both commands does not overwrite
either build.

---

## Package Firefox Extension for AMO Submission

```sh
pnpm build:firefox && pnpm package:firefox
```

Produces: `artifacts/firefox/mitramite_argentina_extension-0.1.0.zip`

This `.zip` can be submitted directly to [addons.mozilla.org](https://addons.mozilla.org).

---

## Environment Variable Reference

| Variable | Default  | Effect                                      |
| -------- | -------- | ------------------------------------------- |
| `TARGET` | `chrome` | Set to `firefox` to produce a Firefox build |

You can also invoke the build script directly with an explicit `TARGET`:

```sh
TARGET=firefox node build.mjs
```

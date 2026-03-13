# Data Model: Firefox Build Support

**Phase**: 1 | **Branch**: `003-firefox-build-support` | **Date**: 2026-03-13

This feature introduces no new runtime data structures. All entities are
**build-time constructs** that live in `build.mjs` and the manifest files.

---

## Entity: BuildTarget

Represents the browser the extension is being compiled for.

| Field   | Type                    | Source               | Notes                                         |
| ------- | ----------------------- | -------------------- | --------------------------------------------- |
| `value` | `"chrome" \| "firefox"` | `process.env.TARGET` | Defaults to `"chrome"` when env var is absent |

**Validation rules**:

- If `TARGET` is set to any value other than `"chrome"` or `"firefox"`, `build.mjs`
  must throw an error immediately (fail-fast).
- Unset `TARGET` silently maps to `"chrome"`.

**State transitions**: None — `BuildTarget` is determined once at process start
and is immutable for the duration of the build.

---

## Entity: ManifestPatch

A partial manifest object merged into the base `public/manifest.json` before it is
written to the output directory. Only the Firefox target uses a non-empty patch.

### Chrome patch (identity — no changes)

```json
{}
```

### Firefox patch

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

**Merge semantics**: Deep merge — top-level keys from the patch are recursively
merged into the base manifest. Existing shared keys (`name`, `version`,
`permissions`, `content_scripts`, etc.) are inherited from the base unchanged.

**Validation rules**:

- `gecko.id` MUST be a non-empty string.
- `gecko.strict_min_version` MUST be `"128.0"` or higher (enforced by `web-ext lint`
  post-build).

---

## Entity: BuildEntry

A single Vite build job inside `build.mjs`. Identical structure to the current
implementation; the only change is that `outDir` is now derived from `BuildTarget`.

| Field         | Type    | Example                    | Notes                                    |
| ------------- | ------- | -------------------------- | ---------------------------------------- |
| `input`       | string  | `src/interceptor/index.ts` | Absolute path to entry point             |
| `outFile`     | string  | `interceptor.js`           | Relative path within output directory    |
| `emptyOutDir` | boolean | `true` (first entry only)  | Clears `dist/<target>/` before first job |

---

## Entity: DistLayout

The canonical on-disk structure produced by a successful build. Both layouts are
identical in content; only the root path differs.

```text
dist/
├── chrome/            ← TARGET=chrome (or default)
│   ├── manifest.json          (Chrome base, no patch)
│   ├── interceptor.js
│   ├── content.js
│   ├── icons/
│   │   └── icon-128.png
│   └── popup/
│       ├── popup.html
│       └── popup.js
└── firefox/           ← TARGET=firefox
    ├── manifest.json          (Chrome base + Firefox patch merged)
    ├── interceptor.js
    ├── content.js
    ├── icons/
    │   └── icon-128.png
    └── popup/
        ├── popup.html
        └── popup.js
```

---

## Entity: PackageArtifact

The distributable `.zip` file produced by `web-ext build`.

| Field    | Value                                                               |
| -------- | ------------------------------------------------------------------- |
| Path     | `artifacts/firefox/mitramite_argentina_extension-0.1.0.zip`         |
| Contents | All files from `dist/firefox/` (web-ext default exclusions applied) |
| Tool     | `web-ext build` (validates before packaging)                        |

**Validation rules**: Must pass `web-ext lint` with zero errors before the zip
is considered a valid distributable.

# Contract: Build Commands

**Feature**: `003-firefox-build-support`  
**Type**: Developer CLI interface (npm scripts)

This document specifies the public command interface exposed to developers
after implementation. These are the commands a developer runs in the terminal.

---

## npm Scripts (package.json `scripts`)

### `build`

```sh
pnpm build
# or: npm run build
```

**Behaviour**: Unchanged. Builds for Chrome target. Equivalent to `build:chrome`.
Output: `dist/chrome/`

**Backwards compatibility**: All existing invocations of `npm run build` / `pnpm build`
continue to work without modification.

---

### `build:chrome`

```sh
pnpm build:chrome
```

**Behaviour**: Builds the extension for Chrome MV3.  
**Env**: `TARGET=chrome` (explicit)  
**Output**: `dist/chrome/` containing the standard Chrome manifest (no patch applied).

---

### `build:firefox`

```sh
pnpm build:firefox
```

**Behaviour**: Builds the extension for Firefox MV3.  
**Env**: `TARGET=firefox`  
**Output**: `dist/firefox/` containing the Firefox-patched manifest
(with `browser_specific_settings.gecko.id` and `strict_min_version: "128.0"`).

---

### `lint:firefox`

```sh
pnpm lint:firefox
```

**Behaviour**: Validates the Firefox build output using `web-ext lint`.  
**Pre-condition**: `dist/firefox/` must exist (run `build:firefox` first).  
**Tool**: `web-ext lint --source-dir dist/firefox`  
**Exit code**: Non-zero if any errors are found (warnings are acceptable per spec).

---

### `package:firefox`

```sh
pnpm package:firefox
```

**Behaviour**: Produces a submission-ready `.zip` in `artifacts/firefox/`.  
**Pre-condition**: `dist/firefox/` must exist (run `build:firefox` first).  
**Tool**: `web-ext build --source-dir dist/firefox --artifacts-dir artifacts/firefox --overwrite-dest`  
**Output**: `artifacts/firefox/mitramite_argentina_extension-<version>.zip`

---

## Environment Variables

| Variable | Values              | Default  | Description                                                      |
| -------- | ------------------- | -------- | ---------------------------------------------------------------- |
| `TARGET` | `chrome`, `firefox` | `chrome` | Selects browser target; determines output dir and manifest patch |

**Error behaviour**: If `TARGET` is set to any value other than `chrome` or
`firefox`, `build.mjs` exits with code 1 and prints:

```
Error: Unknown TARGET "<value>". Expected "chrome" or "firefox".
```

---

## Output Directory Contract

| TARGET    | Output directory | Manifest applied                              |
| --------- | ---------------- | --------------------------------------------- |
| `chrome`  | `dist/chrome/`   | `public/manifest.json` (base, no changes)     |
| `firefox` | `dist/firefox/`  | `public/manifest.json` + Firefox patch merged |

Running both `build:chrome` and `build:firefox` in sequence produces two
independent directories under `dist/` that do not overwrite each other.

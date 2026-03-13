# Contract: Firefox Manifest Patch

**Feature**: `003-firefox-build-support`  
**Type**: Manifest structure contract

This document specifies the exact manifest produced for each build target.
The Firefox manifest is the base Chrome manifest with the patch below deep-merged.

---

## Base Manifest (`public/manifest.json`)

The base manifest is the single source of truth for all shared fields. It is
**never modified** directly. For Chrome, it is copied as-is. For Firefox, it
is merged with the patch defined below.

```json
{
  "manifest_version": 3,
  "name": "Mitramite — Turnos disponibles",
  "version": "0.1.0",
  "description": "...",
  "permissions": ["activeTab", "clipboardWrite"],
  "host_permissions": ["*://mitramite.renaper.gob.ar/*"],
  "action": { ... },
  "content_scripts": [
    {
      "matches": ["*://mitramite.renaper.gob.ar/*"],
      "js": ["interceptor.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["*://mitramite.renaper.gob.ar/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": []
}
```

---

## Firefox Manifest Patch

Applied during the Firefox build step in `build.mjs` using a deep-merge of the
patch object over the base manifest.

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

---

## Resulting Firefox Manifest (`dist/firefox/manifest.json`)

The final output written to `dist/firefox/manifest.json` after merge:

```json
{
  "manifest_version": 3,
  "name": "Mitramite — Turnos disponibles",
  "version": "0.1.0",
  "description": "Muestra los datos de turnos disponibles desde busqueda.php en mitramite.renaper.gob.ar",
  "permissions": ["activeTab", "clipboardWrite"],
  "host_permissions": ["*://mitramite.renaper.gob.ar/*"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "128": "icons/icon-128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["*://mitramite.renaper.gob.ar/*"],
      "js": ["interceptor.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["*://mitramite.renaper.gob.ar/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [],
  "browser_specific_settings": {
    "gecko": {
      "id": "mitramite-argentina@yoursweetginger",
      "strict_min_version": "128.0"
    }
  }
}
```

---

## Field Rationale

| Field                                                | Required | Reason                                                                                                         |
| ---------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `browser_specific_settings.gecko.id`                 | Yes      | Required by Firefox to assign a stable extension identity; mandatory for AMO submission                        |
| `browser_specific_settings.gecko.strict_min_version` | Yes      | `world: "MAIN"` is only available in Firefox ≥128; setting this prevents installation on incompatible versions |
| `world: "MAIN"` (in `content_scripts`)               | Yes      | Retained unchanged; Firefox 128+ supports it; interceptor requires page-scope JS access                        |

---

## Validation

The produced `dist/firefox/manifest.json` must pass `web-ext lint` with zero
errors before the build is considered successful.

```sh
npx web-ext lint --source-dir dist/firefox
```

Expected output: no ERROR-level findings (WARNING level is acceptable).

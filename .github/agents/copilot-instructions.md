# mitramite-argentina-extension Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-13

## Active Technologies
- TypeScript 5.5 (strict mode) + React 18, Vite 5, Vitest 2.x, @testing-library/react 16, happy-dom / jsdom (002-api-json-parser)
- TypeScript 5.5 (strict mode); Node.js ESM (build script) + Vite 5, `@vitejs/plugin-react`; new dev dep: `web-ext` (Mozilla's (003-firefox-build-support)
- YAML (GitHub Actions), Bash (inline steps), Node.js 20 LTS + GitHub Actions (`ubuntu-latest`), `pnpm` v10, `web-ext` v10 (already a `devDependency`), Chrome Web Store Upload API v1.1, Firefox AMO API v5 (via `web-ext sign`), `jq` (pre-installed on runners) (004-cicd-store-publish)
- GitHub Actions artifact storage (90-day retention); no new persistent storage (004-cicd-store-publish)

- **Language**: TypeScript 5.x; Node.js 20+ (build only)
- **Build**: Vite 5.x with `@vitejs/plugin-react` — multi-entry IIFE output for Chrome extension content scripts
- **UI**: React 18.x mounted inside a **closed Shadow DOM** root appended to `document.body`
- **Testing**: Vitest 3.x, jsdom environment, `@testing-library/react`
- **Target**: Chrome 111+ (Manifest V3)

## Project Structure

```text
src/
  interceptor/index.ts       # MAIN-world content script — XHR/fetch patcher
  content/index.ts           # Isolated-world entry — Shadow DOM mount + message listener
  content/parser.ts          # busqueda.php response parser → ParseResult
  content/overlay/Panel.tsx  # React overlay root component
  content/overlay/panel.css  # Shadow-root styles (imported as ?inline string)
  popup/popup.ts             # Action popup toggle sender
  types/busqueda.ts          # Shared TypeScript types
manifest.json                # Chrome MV3 manifest
tests/unit/                  # Vitest unit tests
```

## Commands

```bash
pnpm dev          # Watch build → dist/
pnpm build        # Production build
pnpm test         # Vitest watch
pnpm test:run     # Vitest single pass (CI)
pnpm coverage     # Vitest + coverage
pnpm lint         # ESLint --max-warnings 0
pnpm typecheck    # tsc --noEmit
```

## Key Architecture Notes

- Two content scripts: `interceptor.js` (`world: "MAIN"`) patches `window.fetch`/`window.XMLHttpRequest`; `content.js` (isolated world) mounts React overlay
- Inter-world communication: `CustomEvent('mitramite:busqueda', { detail: { body } })` on `window`
- Popup → content: `chrome.tabs.sendMessage({ type: 'TOGGLE_OVERLAY' })` — no background/service worker
- CSS for shadow root: imported with Vite `?inline` modifier (`import css from './panel.css?inline'`)
- No `chrome.storage` — all state is ephemeral per page load
- Permissions: `activeTab`, `clipboardWrite`, `host_permissions: *://mitramite.renaper.gob.ar/*`

## Code Style

- TypeScript strict mode; no `any` except deliberate escape hatches with `// eslint-disable` comment
- Functions max cyclomatic complexity: 10
- Tests describe behaviour: `'should display slots when JSON parses successfully'`
- No raw HTML injection; overlay uses React with sanitised string renders only
- Spanish UI text (the target audience is Argentine citizens)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->


## Recent Changes
- 004-cicd-store-publish: Added YAML (GitHub Actions), Bash (inline steps), Node.js 20 LTS + GitHub Actions (`ubuntu-latest`), `pnpm` v9, `web-ext` v10 (already a `devDependency`), Chrome Web Store Upload API v1.1, Firefox AMO API v5 (via `web-ext sign`), `jq` (pre-installed on runners)
- 003-firefox-build-support: Added TypeScript 5.5 (strict mode); Node.js ESM (build script) + Vite 5, `@vitejs/plugin-react`; new dev dep: `web-ext` (Mozilla's
- 002-api-json-parser: Added TypeScript 5.5 (strict mode) + React 18, Vite 5, Vitest 2.x, @testing-library/react 16, happy-dom / jsdom

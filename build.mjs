// build.mjs — Runs three separate Vite builds (one per IIFE entry point)
// Uses the API to avoid the Rollup "inlineDynamicImports + multiple inputs" constraint.
// Set TARGET=chrome (default) or TARGET=firefox to select the output directory.
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';

import { build } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

// T003: Read TARGET env var; default to "chrome"; fail-fast on invalid values
const target = process.env.TARGET ?? 'chrome';
if (target !== 'chrome' && target !== 'firefox') {
  throw new Error(`Invalid TARGET="${target}". Must be "chrome" or "firefox".`);
}

// T006: Firefox-specific manifest patch (browser_specific_settings.gecko)
const FIREFOX_MANIFEST_PATCH = {
  browser_specific_settings: {
    gecko: {
      id: 'mitramite-argentina@yoursweetginger',
      strict_min_version: '140.0',
      data_collection_permissions: {
        required: ['none'],
      },
    },
    gecko_android: {
      strict_min_version: '142.0',
    },
  },
};

// T007: Deep-merge patch fields into base manifest object (single responsibility)
function applyManifestPatch(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)
        && typeof result[key] === 'object' && result[key] !== null) {
      result[key] = applyManifestPatch(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const sharedConfig = {
  plugins: [react()],
  build: {
    // T004: per-target output directory
    outDir: `dist/${target}`,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
};

const entries = [
  {
    input: resolve(__dirname, 'src/interceptor/index.ts'),
    outFile: 'interceptor.js',
    emptyOutDir: true,
  },
  {
    input: resolve(__dirname, 'src/content/index.tsx'),
    outFile: 'content.js',
    emptyOutDir: false,
  },
  {
    input: resolve(__dirname, 'src/popup/popup.ts'),
    outFile: 'popup/popup.js',
    emptyOutDir: false,
  },
];

for (const entry of entries) {
  await build({
    ...sharedConfig,
    build: {
      ...sharedConfig.build,
      emptyOutDir: entry.emptyOutDir,
      rollupOptions: {
        input: entry.input,
        output: {
          format: 'iife',
          entryFileNames: entry.outFile,
          // T004: per-target output directory
          dir: `dist/${target}`,
        },
      },
    },
  });
  console.log(`Built: dist/${target}/${entry.outFile}`);
}

// T005 + T008: Copy (and optionally patch) manifest.json to dist/<target>/
const baseManifest = JSON.parse(readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf-8'));
const finalManifest = target === 'firefox'
  ? applyManifestPatch(baseManifest, FIREFOX_MANIFEST_PATCH)
  : baseManifest;
writeFileSync(
  resolve(__dirname, `dist/${target}/manifest.json`),
  JSON.stringify(finalManifest, null, 2),
  'utf-8',
);
console.log(`Manifest written: dist/${target}/manifest.json`);

// build.mjs — Runs three separate Vite builds (one per IIFE entry point)
// Uses the API to avoid the Rollup "inlineDynamicImports + multiple inputs" constraint.
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { build } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sharedConfig = {
  plugins: [react()],
  build: {
    outDir: 'dist',
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
          dir: 'dist',
        },
      },
    },
  });
  console.log(`Built: dist/${entry.outFile}`);
}

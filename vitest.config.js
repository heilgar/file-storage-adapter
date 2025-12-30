import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const coreDistPath = fileURLToPath(new URL('./packages/core/dist/index.js', import.meta.url));
const coreSrcPath = fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@heilgar/file-storage-adapter-core': existsSync(coreDistPath) ? coreDistPath : coreSrcPath,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
    },
  },
});

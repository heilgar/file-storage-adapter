import { defineConfig } from 'vitest/config';

// E2E tests share a single payloadcms/vercel-blob-emulator instance — disable
// parallel files so added test files don't race on shared blob state.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});

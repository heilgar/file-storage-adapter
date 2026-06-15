import { defineConfig } from 'vitest/config';

// E2E tests share a single Floci instance + bucket — disable parallel files so
// added test files don't race on the shared bucket state.
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});

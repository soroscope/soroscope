import { defineConfig } from 'vitest/config';

// These tests run the in-process engine (a native module built with Rust), so they
// run in their own CI job rather than in the root unit suite.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/engine/**/*.test.ts'],
  },
});

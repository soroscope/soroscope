import { defineConfig } from 'vitest/config';

// The engine tests need the native engine (`pnpm build:engine`, which needs Rust),
// so they run in their own CI job rather than in the root unit suite.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/engine/**/*.test.ts'],
  },
});

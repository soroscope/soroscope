import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    // Public endpoints are shared infrastructure: run files one at a time and
    // retry once to absorb the occasional dropped connection.
    fileParallelism: false,
    retry: 1,
  },
});

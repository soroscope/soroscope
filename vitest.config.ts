import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
    // Integration tests talk to live Stellar networks; they run in their own job.
    exclude: ['packages/*/tests/integration/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/bin.ts', 'packages/*/src/action.ts', 'packages/demo/**', 'packages/{gql,dev,testing,inspect,differential}/**'],
      // Unit tests cover the pure logic (decoders, specs, comparison, registry state machine).
      // The router, probe, invoke, CLI, Action and MCP server are covered by the integration
      // suites against live networks, which are not part of this number. Raise this as unit
      // coverage grows; never lower it to make a build pass.
      thresholds: {
        lines: 45,
      },
    },
  },
});

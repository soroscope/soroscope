import { defineConfig } from 'vitest/config';
import rootConfig from '../../vitest.config';

export default defineConfig({
  test: {
    ...rootConfig.test,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
  },
});

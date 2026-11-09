import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['probe-core.js'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});

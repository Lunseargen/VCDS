import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'ui/tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**', 'src/hal/sim.ts', 'ui/src/**', 'ui/logsPlugin.ts'],
      exclude: ['ui/src/main.tsx', 'ui/src/**/*.d.ts', 'ui/src/styles.css'],
    },
  },
});

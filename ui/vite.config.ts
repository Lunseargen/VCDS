import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vehicleLogsPlugin } from './logsPlugin';

const repoRoot = resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
  plugins: [react(), vehicleLogsPlugin(repoRoot)],
  server: { port: 5175, strictPort: false },
  build: { outDir: resolve(repoRoot, 'dist/ui'), emptyOutDir: true },
});

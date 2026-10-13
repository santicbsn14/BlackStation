import { cpSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'seed/index': 'src/seed/index.ts' },
  format: 'esm',
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  noExternal: ['@blackstation/shared'],
  onSuccess: async () => {
    // El seed lee los JSON en runtime (relativos a su propio archivo).
    cpSync('src/seed/data', 'dist/seed/data', { recursive: true });
  },
});

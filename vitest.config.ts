import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@fdc/shared': r('./packages/shared/src/index.ts'),
      '@fdc/core': r('./packages/core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/api/**/*.test.ts'],
    reporters: ['default'],
  },
});

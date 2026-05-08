import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['scripts/lib/**/*.ts'],
      exclude: ['scripts/tests/**', 'scripts/**/*.test.ts'],
    },
  },
});

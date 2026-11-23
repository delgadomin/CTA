import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    // Playwright specs live next to unit tests but must not run under Vitest.
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          rapier: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});

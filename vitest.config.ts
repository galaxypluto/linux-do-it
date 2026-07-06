import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://linux.do/',
      },
    },
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup-dom.ts'],
    teardownTimeout: 10_000,
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@podman-desktop/api': fileURLToPath(
        new URL('./tests/fixtures/podman-desktop-api.ts', import.meta.url),
      ),
    },
  },
});

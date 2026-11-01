import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Las pruebas no cargan los archivos .env de la raíz ni el middleware de Vite.
  envDir: path.resolve(__dirname, 'src/test'),
  server: {
    fs: {
      strict: false,
    },
  },
  test: {
    env: {
      VITE_SUPABASE_URL: 'https://supabase.atlas-tests.invalid',
      VITE_SUPABASE_ANON_KEY: 'atlas-test-key-not-a-credential',
      VITE_BACKEND_BASE_URL: 'https://api.atlas-tests.invalid',
      VITE_R2_PUBLIC_DOMAIN: 'https://r2.atlas-tests.invalid',
      VITE_ENVIRONMENT: 'test',
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'src/test/setup.ts')],
    css: true,
    clearMocks: true,
  },
});

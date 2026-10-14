import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mesmo alias do `tsconfig.json` (`@/*` → `./src/*`), para os testes poderem importar
// módulos que dependem dele, como `execution-monitor.ts`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});

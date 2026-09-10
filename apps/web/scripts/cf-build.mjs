// Build para Cloudflare Workers.
//
// Troca `src/lib/prisma-client.ts` pela variante `.workerd` antes de empacotar e
// restaura no fim — ver o comentário longo em `src/lib/prisma-client.ts` para o
// porquê (o workerd proíbe gerar WASM em runtime, e não há como resolver por
// condição de export nem por alias de bundler).
//
// A restauração roda em `finally` para não deixar a árvore suja se o build falhar.
// No builder da Cloudflare isso é irrelevante (clone efêmero), mas localmente sim.
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Pares [arquivo versionado (Node), variante workerd].
const trocas = [
  ['src/lib/prisma-client.ts', 'src/lib/prisma-client.workerd.ts'],
  ['src/lib/prisma.ts', 'src/lib/prisma.workerd.ts'],
].map(([alvo, variante]) => ({
  alvo: resolve(webDir, alvo),
  variante: resolve(webDir, variante),
}));

const originais = trocas.map(({ alvo }) => readFileSync(alvo, 'utf8'));
let code = 1;
try {
  for (const { alvo, variante } of trocas) copyFileSync(variante, alvo);
  console.log('[cf-build] prisma-client.ts + prisma.ts -> variantes workerd');
  code = spawnSync('opennextjs-cloudflare', ['build'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
  }).status ?? 1;
} finally {
  trocas.forEach(({ alvo }, i) => writeFileSync(alvo, originais[i]));
  console.log('[cf-build] arquivos restaurados para as variantes de Node');
}
process.exit(code);

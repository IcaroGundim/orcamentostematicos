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
const alvo = resolve(webDir, 'src/lib/prisma-client.ts');
const variante = resolve(webDir, 'src/lib/prisma-client.workerd.ts');

const original = readFileSync(alvo, 'utf8');
let code = 1;
try {
  copyFileSync(variante, alvo);
  console.log('[cf-build] prisma-client.ts -> variante workerd (@prisma/client/edge)');
  code = spawnSync('opennextjs-cloudflare', ['build'], {
    cwd: webDir,
    stdio: 'inherit',
    shell: true,
  }).status ?? 1;
} finally {
  writeFileSync(alvo, original);
  console.log('[cf-build] prisma-client.ts restaurado para a variante de Node');
}
process.exit(code);

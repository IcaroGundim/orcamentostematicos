import 'server-only';

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Driver ÚNICO para os dois deployments: Vercel (Node) e Cloudflare Workers.
 *
 * Antes havia escolha por runtime, com `@prisma/adapter-pg` na Vercel. Isso
 * arrastava o `pg` para o bundle do Worker mesmo sem ser usado lá, e o build
 * quebrava em `Could not resolve "pg-cloudflare"` — o `pg` faz um require lazy
 * desse pacote dentro de `getCloudflareStreamFuncs`, e o bundler do servidor do
 * OpenNext não tem ponto de extensão para marcá-lo como external.
 *
 * O driver serverless do Neon roda nos dois runtimes, então a escolha some junto
 * com o problema. A objeção era a transação interativa de 60s com
 * `pg_advisory_xact_lock` de `replaceImportedBudget`, que é o que a publicação
 * automática diária do SICAF usa: foi testada contra o banco real sobre este
 * adaptador e completou em 2,8s.
 *
 * Os scripts de `scripts/` (backup, folha) seguem no `pg`: rodam em Node no
 * GitHub Actions, não passam por bundler, e não havia motivo para mexer neles.
 */
function createPrisma() {
  const adapter = new PrismaNeon({ connectionString: process.env['DATABASE_URL']! });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

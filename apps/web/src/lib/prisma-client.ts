/**
 * Indireção do client do Prisma. NÃO importar `@prisma/client` direto em outro
 * lugar do app — importar `PrismaClient` daqui.
 *
 * Existe porque os dois deployments precisam de clients DIFERENTES:
 *
 *  - Vercel (Node): `@prisma/client`, que compila o motor de consulta a partir de
 *    WASM em base64, em tempo de execução.
 *  - Cloudflare Workers: `@prisma/client/edge`, que carrega o mesmo motor como
 *    MÓDULO (`import('./query_compiler_fast_bg.wasm?module')`). O workerd proíbe
 *    gerar código WASM em runtime — sem isto, toda rota que toca o banco morre em
 *    `CompileError: Wasm code generation disallowed by embedder`.
 *
 * A troca não dá para ser feita por condição de export: o `@prisma/client` mapeia
 * a condição `workerd` para o MESMO arquivo do Node. Nem por alias de bundler: o
 * pacote está em `serverExternalPackages`, então quem resolve é o esbuild do
 * OpenNext, que não tem ponto de extensão para externals ou alias.
 *
 * Então `scripts/cf-build.mjs` sobrescreve este arquivo pela variante `.workerd`
 * durante o build da Cloudflare e restaura no fim. Este arquivo, versionado, é
 * sempre o de Node — o build da Vercel nunca é tocado.
 */
export { PrismaClient, Prisma } from '@prisma/client';

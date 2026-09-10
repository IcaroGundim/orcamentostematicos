/**
 * Variante do client do Prisma para Cloudflare Workers. Ver `prisma-client.ts`.
 * `scripts/cf-build.mjs` copia este arquivo por cima daquele durante o build.
 */
export { PrismaClient, Prisma } from '@prisma/client/edge';

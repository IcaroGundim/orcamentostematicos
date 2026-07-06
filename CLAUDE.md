# Orientações para agentes (Claude)

Sistema de Orçamentos Temáticos do Acre — Next.js + Prisma + PostgreSQL/Neon, monorepo npm
workspaces (`apps/web`), deploy na Vercel.

## Banco de dados — REGRAS CRÍTICAS

- **`DATABASE_URL` aponta para PRODUÇÃO** e o Neon usa um único branch, com retenção
  point-in-time de só ~6h (aumentar é pago). Um `prisma db push` destrutivo já apagou toda a
  curadoria (`ThematicAssignment` + `ActionValidation`); sem backup, a perda é irreversível.
- **NUNCA** rode `prisma db push` cru, `prisma migrate reset` ou DDL destrutivo contra
  produção. Mudanças de schema vão **exclusivamente** pelo push protegido:
  `cd apps/web && npm run db:push` (`scripts/safe-push.mjs`), que faz backup, mostra o diff,
  bloqueia perda de dados (exige `--allow-destructive` explícito) e pede confirmação.
- **Antes** de qualquer operação de risco no banco, rode `npm run db:backup` (ou dispare o
  workflow `.github/workflows/backup.yml`). Backups ficam versionados em `backups/<data>/`.

## Dados de domínio

- "Marcações"/curadoria = tabela `ThematicAssignment` (tema OCAD/OSG/CLIMATICO + eixo +
  classificação + ponderador por ação). A chave que liga marcações entre versões de QDD é
  `actionLogicalKey` em `apps/web/src/lib/qdd-parser.ts`.
- Reimportar QDD religa marcações via `remapAssignments`/`reattachOrphanAssignmentsToVigente`
  em `apps/web/src/lib/store.ts` (usa `updateMany`, não deleta).

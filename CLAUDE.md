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

## Frontend do `/orcamento` — LEIA ANTES DE EDITAR

- O módulo de execução orçamentária tem um **contrato de design**:
  `docs/design-orcamento.md`. **Leia-o antes** de qualquer edição em
  `apps/web/src/app/orcamento/**`, `execution-monitor.ts`, `expense-nature.ts`,
  `payroll-scope.ts`, `payroll-portal.ts`, `execution-breakdown-panel.tsx`,
  `fiscal-secretariat-view.tsx`, `payroll-panel.tsx` ou
  `overview-scheduled-actions-panel.tsx`.
- Ele existe para **impedir AI slop**: fixa a paleta, proíbe gradientes/sombras/cantos
  arredondados, registra na seção 9 as decisões que *parecem* bugs mas são deliberadas, e
  traz um checklist obrigatório na seção 11. Ignorá-lo já custou retrabalho — uma sessão
  inteira propondo âmbar e degradês que as seções 10.2 e 10.4 proíbem explicitamente.
- Quando o documento e o código divergirem, **o código vence**: corrija o documento, não o
  código.

## Múltiplos exercícios financeiros

- A invariante é **uma única `BudgetImport` por ano**, garantida por índice único.
  `getVigenteImportId(year)` continua sendo a porta de entrada compatível; sem `year`,
  resolve o exercício corrente.
- Todo caminho de leitura precisa do recorte por exercício. Os pontos que já
  causaram mistura silenciosa estão comentados no código —
  em especial `ensureMissingAssignmentValidations` (`store.ts`), que **fabrica
  entregas** se rodar sem o gate de exercício comparativo.
- Exercício comparativo (`FiscalYear.comparisonOnly`) tem execução e marcações,
  mas **não** gera `ValidationCycle` nem `ActionValidation`, e só a SEPLAN o abre.
- `FiscalYear.isCurrent` marca o exercício corrente. **`getCurrentYear()` é fronteira
  de autorização**, não padrão de tela: seis rotas de escrita das secretarias
  comparam com ele. Trocar o corrente derruba a escrita no exercício anterior — por
  isso mora na tela Exercícios, com confirmação, e nunca no seletor do cabeçalho.
  Sem nenhum ano marcado, vale o `max(year)` entre os vigentes (comportamento antigo).
- **Quem conhece o próprio exercício vence o contexto.** `loadDiffContext` deriva o
  ano da própria prévia e ignora `?year=`; a importação usa o campo do formulário.
  Deixar o ano ambiente governar a escrita foi o que fez a conferência de um QDD de
  2025 comparar contra o cadastro de 2026 e propor sobrescrevê-lo.
- `resolveRequestYear(req, user, { mode: 'strict' })` nas escritas: recusa ano
  **ausente** e inexistente. `resolveExerciseYear` retorna cedo quando não há
  parâmetro, então a ausência precisa ser barrada no helper, não no `store`.
- A estrutura de governo é por exercício (`ExerciseOrganization`, `ExerciseUnit`,
  `ExerciseUnitExecutor`). As tabelas antigas sem ano continuam no banco como rede
  de segurança — **não removê-las sem decisão explícita**; guardam a curadoria
  original (6 unidades realocadas, 24 executores customizados) migrada em
  `scripts/backfill-exercise-structure.mjs`.

## Dados de domínio

- "Marcações"/curadoria = tabela `ThematicAssignment` (tema OCAD/OSG/CLIMATICO + eixo +
  classificação + ponderador por ação). A chave que liga marcações entre versões de QDD é
  `actionLogicalKey` em `apps/web/src/lib/qdd-parser.ts`.
- Reimportar QDD atualiza a mesma base e conserva o ID das ações equivalentes pela chave
  lógica. Ações marcadas ausentes ficam com `presentInCurrentQdd=false`; consultas e
  escritas normais devem sempre excluir essas ações, que só aparecem no painel da SEPLAN.

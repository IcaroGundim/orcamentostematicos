# Sistema de Gestão dos Orçamentos Temáticos do Acre

MVP em monorepo para importar a estrutura vigente do QDD do Estado do Acre, consolidar ações orçamentárias, classificar manualmente nos orçamentos temáticos e validar entregas pelas secretarias.

## Stack

- Aplicação: Next.js, React, TypeScript, Tailwind CSS, shadcn/ui-style components, Lucide React, React Hook Form, Zod, TanStack Table e Recharts.
- API: Route Handlers do Next.js em `/api`.
- Dados: Prisma com PostgreSQL/Neon.
- Deploy: Vercel.

## Scripts

```bash
npm install
npm run dev
```

Web: `http://localhost:3000`

API interna: `http://localhost:3000/api`

## Desenvolvimento local (banco de dados)

O login e as APIs usam PostgreSQL (Neon) via Prisma. Sem `DATABASE_URL`, o login falha com erro de API.

1. Gere o `.env.local` com a URL do Neon (recomendado):

```powershell
npx neonctl auth
.\scripts\setup-local-env.ps1
```

Ou copie `apps/web/.env.example` para `apps/web/.env.local` e cole `DATABASE_URL` manualmente (Vercel → Settings → Environment Variables → Reveal, ou [Neon Console](https://console.neon.tech)). O `vercel env pull` costuma deixar `DATABASE_URL` vazio por causa da integração Neon.

2. Aplique migrações e usuários de teste:

```bash
cd apps/web
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

3. Reinicie `npm run dev` na raiz do monorepo (obrigatório após alterar `.env.local`).

Credenciais padrão do seed: `admin@seplan.ac.gov.br` / `admin123` (SEPLAN).


## Banco de dados: mudanças de schema e backups

> ⚠️ **`DATABASE_URL` é PRODUÇÃO.** Um `prisma db push` destrutivo já apagou toda a
> curadoria temática (tabela `ThematicAssignment`). **Nunca** rode `prisma db push` cru,
> `prisma migrate reset` ou DDL destrutivo contra produção. A retenção do Neon é de só ~6h
> (aumentar é pago), então **backup é a rede de segurança** — nunca mexa no schema sem um.

**Mudança de schema (fluxo obrigatório):** use sempre o push protegido, nunca o cru.

```bash
cd apps/web
npm run db:push          # faz backup, mostra o diff, bloqueia perda de dados, pede confirmação
# só se um DROP for realmente intencional (dados já preservados no backup):
npm run db:push -- --allow-destructive
npm run db:diff          # apenas prever as diferenças, sem aplicar
```

`db:push` (`scripts/safe-push.mjs`) sempre: (1) roda `db:backup`; (2) exibe o diff
schema × banco; (3) **aborta** se o push removeria tabela/coluna, exigindo
`--allow-destructive` explícito; (4) só então executa o `prisma db push`.

**Backups:**

- Automático: `.github/workflows/backup.yml` roda diariamente (e sob demanda via
  *Run workflow*) e **commita** os dumps em `backups/<data>/`. Requer o segredo
  `DATABASE_URL` no repositório. Dispare manualmente **antes** de qualquer operação de risco.
- Cada backup traz `curadoria.json` (dump bruto restaurável), `marcacoes.{json,csv,xlsx}`
  (marcações com a chave lógica, prontas para reimportar) e as validações/ciclos.
- Hábito recomendado: exporte a Visão Geral periodicamente com **todos os temas**
  selecionados (foi um export assim que permitiu recuperar OCAD após o incidente).

## Fluxo principal

1. Entrar como SEPLAN Admin.
2. Importar ou consultar a estrutura vigente do QDD.
3. Classificar ações em OCAD, OSG ou Climático, com eixo e metodologia.
4. Abrir ciclo de validação.
5. Entrar como representante de secretaria e preencher a validação.
6. Revisar e aprovar/devolver pela SEPLAN.

## Exercícios financeiros

O sistema comporta **vários exercícios ao mesmo tempo**. A invariante é **um QDD
vigente por exercício** — importar 2025 não afeta 2026.

- **Exercício corrente**: marcado explicitamente pela SEPLAN na aba
  **Estrutura vigente → Exercícios**. É o único em que as secretarias preenchem
  entregas, então trocá-lo é ato de governança e pede confirmação. Enquanto nenhum
  exercício estiver marcado, vale o ano mais recente com QDD vigente.
- **Exercício apenas comparativo**: marcado no momento da importação. Recebe
  execução e marcações temáticas, mas **não** gera ciclos de validação nem
  entregas. A política é do exercício (tabela `FiscalYear`), definida na primeira
  importação do ano; reimportar não a altera, e o `confirm` recusa uma importação
  cuja opção divirja das anteriores do mesmo ano. Para mudar deliberadamente:
  `PATCH /api/exercises/<ano>`.
- Exercícios comparativos são **visíveis apenas à SEPLAN**, validado no servidor.
- Um seletor no cabeçalho troca o exercício; ele vive na URL (`?exercicio=2025`) e
  fica visível mesmo quando há um só exercício.
- **Quando a operação conhece o próprio exercício, ela vence o seletor.** A
  conferência de uma prévia de QDD confere contra o exercício **da prévia**, e a
  importação usa o campo "Exercício" do formulário. O seletor decide só onde a
  operação não sabe — e aí o alvo aparece na própria tela.
- Rotas de **escrita** exigem o exercício explicitamente e recusam um ano ausente ou
  inexistente; rotas de **leitura** caem no corrente, para um link antigo não quebrar.
- A **folha de pagamento não acompanha** o seletor: mostra sempre o mês mais
  recente publicado pelo Portal da Transparência.
- Cada exercício tem a **sua própria estrutura de governo**
  (`ExerciseOrganization` / `ExerciseUnit` / `ExerciseUnitExecutor`), porque
  `active` significa "presente no QDD daquele ano". As tabelas antigas sem ano
  (`GovernmentOrganization`, `GovernmentUnit`, `UnitExecutor`) seguem no banco
  como rede de segurança até uma remoção deliberada.
- O catálogo de fontes é por exercício (`src/lib/fontes-recursos.ts`), com cada ano
  registrado explicitamente e **nunca** caindo no catálogo de outro por conta
  própria — rótulo errado é pior que ausente. 2025 e 2026 compartilham o mesmo
  anexo, que não mudou entre os dois.

## Base vigente e importação

O sistema permite importar manualmente um QDD em `.xls` ou `.xlsx` pela interface da SEPLAN. A prévia consolida as linhas do QDD em ações orçamentárias e mostra o **exercício detectado** (e de onde ele foi lido: cabeçalho da planilha, nome do arquivo ou, em último caso, o ano atual — que merece conferência). Ao confirmar, o QDD é registrado como base vigente daquele exercício, preservando órgãos, unidades, aplicações programadas, funções programáticas, projetos/atividades, contas de despesa, descrições, fontes e valores.

Cada exercício possui **uma única `BudgetImport`**. Uma nova confirmação atualiza essa
mesma base e as ações equivalentes em lugar, preservando IDs, marcações, validações e
entregas. Ações classificadas que deixam de aparecer no arquivo ficam inativas, fora dos
totais, e são reativadas automaticamente se reaparecerem. O histórico guarda somente os
metadados leves de cada atualização.

### Implantação da importação única em banco já existente

Execute em janela controlada, sem confirmar novos QDDs durante o processo:

```bash
cd apps/web
npm run db:single-import:phase1       # backup + campos/tabela, ainda sem índice único
npm run db:consolidate-qdd            # prévia somente leitura; resolva conflitos se houver
npm run db:consolidate-qdd -- --apply # novo backup + consolidação
npm run db:push                       # aplica BudgetImport.year UNIQUE
```

O consolidado escolhe o `VIGENTE` mais recente de cada exercício, converte os imports
antigos em revisões leves e preserva ações marcadas sem correspondente como inativas.

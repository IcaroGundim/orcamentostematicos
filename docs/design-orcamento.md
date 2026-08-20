# Design — Monitoramento da Execução Orçamentária (`/orcamento`)

Documento de **contrato** do módulo de execução orçamentária do painel da SEPLAN.
Seu objetivo é **preservar a estrutura de frontend que está posta** e impedir que
mudanças — em especial mudanças feitas por modelos de IA — introduzam elementos
estranhos ao sistema.

Todo conteúdo é descrito a partir do código atual. Referências relativas a
`apps/web/`. Quando este documento e o código divergirem, o código vence; a
divergência deve ser corrigida aqui, não no código.

---

## 1. Propósito e uso do documento

Escopo de aplicação (qualquer edição nestes caminhos deve respeitar os contratos
deste documento):

- `src/app/orcamento/page.tsx` — a página inteira;
- `src/components/domain/execution-breakdown-panel.tsx`,
  `src/components/domain/fiscal-secretariat-view.tsx`,
  `src/components/domain/payroll-panel.tsx`,
  `src/components/domain/overview-scheduled-actions-panel.tsx` — componentes do módulo;
- `src/lib/execution-monitor.ts`, `src/lib/payroll-scope.ts`,
  `src/lib/payroll-portal.ts`, `src/lib/expense-nature.ts`,
  `src/lib/fontes-recursos.ts`, `src/lib/expense-breakdown.ts`,
  `src/lib/organization-acronym.ts` — lógica;
- `scripts/collect-payroll.mjs` e `.github/workflows/folha.yml` — coleta da folha;
- `prisma/schema.prisma` — apenas se a seção 2 (regra R12) for seguida.

Regras de uso:

1. As seções 2 a 6 são **invariantes**. Violá-las exige reescrever a seção
   correspondente **antes** da mudança.
2. A seção 9 lista decisões deliberadas que parecem bugs. Não "corrigir" nenhuma
   sem atualizar este documento.
3. A seção 10 é a lista de proibições (anti-slop). Violar qualquer item é motivo
   para rejeitar a mudança.
4. A seção 11 é o checklist obrigatório antes de encerrar qualquer mudança.
5. **Ler antes de propor.** Este documento é pré-requisito de qualquer edição nos
   caminhos acima — e também de qualquer *sugestão* feita ao usuário. Descobrir o
   contrato depois da mudança é tarde: a violação já foi apresentada como opção
   legítima e o usuário já gastou tempo recusando-a.

## 2. Arquitetura e invariantes estruturais

1. **R1 — Página única, client-side.** O módulo é um único componente cliente em
   `src/app/orcamento/page.tsx`. Não dividir em sub-rotas, não converter para
   Server Components, não migrar o carregamento de dados para RSC. Todo o estado
   é local (`useState`/`useMemo`/`useCallback`/`useEffect`); não há store global
   nem contexto.
2. **R2 — Carga única de dados.** `load()` dispara `Promise.all` de
   `/budget-actions`, `/organizations` e `/metadata`, e busca `/payroll` em
   paralelo com `catch` próprio que resulta em `null` — a folha é fonte externa e
   opcional; se a coleta não rodou ou o portal caiu, o restante do painel não pode
   deixar de carregar. Nenhuma rota nova pode ser consultada a cada interação;
   nada é re-carregado por troca de aba, filtro ou métrica.
   **A única exceção é a troca de exercício** (seção 3.1): ela recarrega tudo,
   porque o QDD é outro. `load()` depende de `year`, e o efeito de sessão/redirect
   é separado do de carga — juntá-los faria o redirecionamento ser reavaliado a
   cada troca de ano.
3. **R3 — Agregações são funções puras.** Toda agregação mora em
   `src/lib/execution-monitor.ts`, recebe `BudgetAction[]` (com `expenseLines`)
   e devolve `ExecutionRow[]`. Sem I/O, sem hooks, sem estado, sem importar de
   `server-only`. A UI apenas as chama dentro de `useMemo`. Proibido duplicar
   lógica de agregação em componentes.
4. **R4 — Abas montadas com `forceMount` + componentes `memo`.** Todas as
   `TabsContent` das visualizações usam `forceMount` (a classe
   `data-[state=inactive]:hidden` do `TabsContent` é o que evita o piscar ao
   alternar — ver `src/components/ui/tabs.tsx:226-243`). `ExecutionChartCard`,
   `ExecutionTablePanel`, `PayrollPanel`, `OverviewScheduledActionsPanel` e
   `OverviewActionRow` (`overview-scheduled-actions-panel.tsx:98`) são `memo`.
   Sem `memo`, cada mudança de estado da página (troca de aba, de métrica
   ou de filtro) re-renderizaria os 20+ gráficos Recharts de **todas** as abas,
   inclusive as ocultas.
5. **R5 — Navegação em dois níveis, preservada.** Dimensão de análise
   (`Geral`/`Emendas`, na trilha lateral, `page.tsx:110-113`) × Visualização
   (`Visão geral`/`Órgão`/`Ações`/`Tabela`/`Folha de pagamento`, no footer,
   `page.tsx:115-121`). Selecionar uma dimensão força `setContentView('overview')`
   (`page.tsx:789-792`). Nova visualização = novo item em `CONTENT_VIEWS`, com
   entrada no footer, no comportamento de setas e na lógica de
   anterior/próxima; nova dimensão = novo item em `VIEWS`, com grade própria nas
   abas `overview` e `table`.
6. **R6 — Shell de zoom e rolagem interna.** A raiz é
   `orcamento-page-root h-svh w-full overflow-hidden`; dentro dela, o shell
   `orcamento-zoom-shell` aplica `width: 100/0.95%`, `height: 100/0.95%`,
   `transform: scale(0.95)` com `transformOrigin: 'top left'` (`PAGE_ZOOM`,
   `page.tsx:66, 588-596`). O cabeçalho do app fica **dentro** do shell. Todo
   scroll acontece dentro de `main` (`orcamento-main … overflow-y-auto`) e das
   áreas internas — nunca na janela. Não remover o zoom, não permitir scroll no
   documento, não quebrar os `min-h-0`/`overflow-hidden` da cadeia de colunas.
7. **R7 — Trilha lateral com colapso.** A trilha é `xl:w-64` expandida e
   `xl:w-16` colapsada, com `transition-[width] duration-300 ease-out`
   (`page.tsx:650-657`). Colapsada, os blocos de filtros ficam `xl:hidden` e os
   itens de navegação `xl:justify-center` com rótulo `xl:sr-only` e `title` como
   tooltip. A trilha **some por completo** apenas nas visões executivas
   (`Órgão` e `Folha de pagamento`, `isExecutiveView`, `page.tsx:573`) — e,
   nesses casos, também somem o heading com contagem e os KPIs globais
   (`page.tsx:801-848`), pois são visões que ou não usam os filtros do QDD (folha)
   ou têm os próprios controles (órgão).
8. **R8 — Filtros em cascata.** Órgão → Unidade → Fonte. Trocar órgão limpa
   unidade e fonte; trocar unidade limpa fonte (`page.tsx:718-737`). As opções de
   unidade e fonte são derivadas das ações já filtradas pelo nível anterior
   (nunca apontam para recortes vazios). O botão "Limpar filtros" está sempre
   presente e desabilitado quando `!hasFilters` — o bloco não muda de altura ao
   filtrar (`page.tsx:549-564, 758-769`).
9. **R9 — Integrações externas seguem o padrão da folha.** Fonte externa
   (portal, API pública) = coleta em job server-side (`scripts/` + workflow
   GitHub), persistência **somente de agregados**, leitura por rota `/api/*`
   protegida por sessão. Proibido buscar em portal externo a partir do cliente,
   proibido persistir dado pessoal identificável.
10. **R10 — Autorização e somente-leitura.** A página redireciona para
    `/secretaria` qualquer sessão que não seja `SEPLAN_ADMIN` (`page.tsx:270-272`)
    e para `/login` sem sessão. O módulo não escreve em nenhuma tabela: nenhuma
    rota de escrita nova para este domínio.
11. **R11 — Hook order.** Todos os hooks são declarados antes do guard de sessão
    (`if (!session) return null`, `page.tsx:566`) — o comentário no código
    (`page.tsx:229-230`) explica que mover hooks para depois desse `return`
    condicional quebra as regras do React. Mudanças que mexam nesse fluxo devem
    preservar a ordem.
12. **R12 — Sem mudança de schema para este módulo.** Ele é somente leitura.
    Se um dia precisar de tabela nova, siga o fluxo protegido do CLAUDE.md
    (`npm run db:push`, backup antes, bloqueio de DROP) e registre aqui. Alterar
    `PayrollSnapshot`/`PayrollGroup` exige reescrever as seções 6.6 e 8.

## 3. Anatomia da tela

Estrutura hierárquica (`page.tsx`):

```
orcamento-page-root (h-svh w-full overflow-hidden)
└─ orcamento-zoom-shell (scale 0.95)
   ├─ header (h-16, bg-green-900, sticky, z-30)
   ├─ main (flex-1, min-h-0; coluna em <xl, linha em ≥xl)
   │  ├─ sidebar (trilha: filtros + dimensão) — oculta em visões executivas
   │  └─ content column (heading, KPIs, Tabs das visualizações)
   └─ footer de navegação (min-h-11, Anterior / abas / Próxima)
```

### 3.1 Cabeçalho do app

`sticky top-0 z-30 shrink-0 border-b border-black bg-green-900 text-white`
(`page.tsx:598`). Compõe-se de:

- logo `/logo.svg` (`h-8 w-auto`);
- divisor `|` (`hidden lg:inline`, `text-primary-foreground/50`);
- título `EXECUÇÃO ORÇAMENTÁRIA` — `font-semibold uppercase tracking-widest`,
  `fontSize: 22px`, `truncate`;
- **seletor de exercício** (`ExerciseSelect`,
  `src/components/domain/exercise-select.tsx`), primeiro item do grupo à direita.
  É um `Select` de `components/ui/select` com a mesma receita visual dos botões
  vizinhos (`rounded-sm border-black/50 bg-white text-foreground shadow-none
  hover:bg-stone-100`) e ícone `CalendarRangeIcon`. Fica **visível mesmo com
  um só exercício** (desabilitado nesse caso): quem opera precisa enxergar em que
  exercício está, não só poder trocá-lo. Exercícios apenas comparativos ganham o
  sufixo `Comparativo` na lista, e o corrente, `Corrente`. O estado vive na URL
  (`?exercicio=2026`) via `useExercise` (`src/lib/use-exercise.ts`), e trocar o
  exercício **limpa órgão, unidade, fonte, função, subfunção e busca**, porque a
  estrutura do QDD difere entre anos. Não usa `useHoverPill`: a seção 4.4 vale
  para abas/pílulas, não para `Select`.
- três botões à direita, todos `variant="secondary"` com a receita visual
  `rounded-sm border-black/50 bg-white text-foreground shadow-none
  hover:bg-stone-100`:
  - **Orçamentos Temáticos** → `router.push('/seplan')` (`hidden lg:inline-flex`);
  - **Atualizar** → re-executa `load()`; ícone `RefreshCwIcon` ganha
    `animate-spin` enquanto `isLoading`; rótulo `hidden lg:inline`;
  - **Sair** → `clearStoredSession()` + `router.push('/login')`, com trava
    `isSigningOut`.

### 3.2 Trilha lateral (não-executiva)

Coluna `border border-black/70 bg-white`, rolagem interna no bloco de filtros,
quatro zonas:

1. **Título** `Filtros da execução` — `bg-green-900 px-3 py-2 text-xs font-semibold
   uppercase tracking-wide text-white` (some quando colapsada).
2. **Seletor de estágio** — rótulo "Exibir valores de" (`text-xs font-medium
   text-muted-foreground`) + `Select` com `EXECUTION_METRICS` em ordem do ciclo da
   despesa (dotação inicial → atualizada → empenhado → liquidado → pago), com
   `aria-label="Estágio da despesa exibido nos gráficos"`.
3. **Filtros** (bloco rolável, `border-b border-black/30`):
   - **Buscar**: `Input` com ícone `SearchIcon` à esquerda (`pl-8`), placeholder
     "Ação, programa…". Normalização `normalize()` (sem acentos, minúsculas) sobre
     `application`, `projectActivity`, `functionalProgram`, `organizationName`
     (`page.tsx:387-422`).
   - **Órgão**: `SearchableCombobox` com opções `{code} — {name}` ordenadas por
     código + "Todos os órgãos" (`allValue = 'ALL'`).
   - **Unidade**: opções derivadas das ações do órgão selecionado; chave
     `{org}|{unit}`; rótulo com `org/unit — nome` quando não há órgão filtrado,
     `unit — nome` quando há.
   - **Fonte de recurso**: opções derivadas das linhas das ações do órgão+unidade
     selecionados; código normalizado por `normalizeSourceCode` (remove
     não-dígitos; se sobrar vazio, usa o texto cru) e rótulo
     `{código} — {getFonteLabel ?? "Fonte não catalogada"}`.
   - **Função/Subfunção**: `FunctionalClassificationFilters` (mesmo componente
     dos orçamentos temáticos), com `actionMatchesFunctionalFilters` — o filtro de
     subfunção depende da função selecionada.
   - **Limpar filtros**: `variant="outline" size="sm"`, `disabled={!hasFilters}`.
4. **Dimensão de análise** (`page.tsx:772-795`): rótulo de seção
   `text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground`
   (vira `xl:sr-only` quando colapsada) + `ExecutionViewNavigation`.

`ExecutionViewNavigation` (`page.tsx:123-204`): lista com `role="tablist"`,
itens `role="tab"` com `aria-selected`, `data-execution-view` e
`data-hover-tab-value`. A "pílula" verde (`bg-green-900`) mede a caixa **inteira**
do item (funciona tanto na coluna do desktop quanto na linha de telas menores) e
o marcador de seleção é um retângulo bege de 4px (`bg-[#b8b477]`) na borda
inicial do item — ambos com `transition` de 500ms/300ms. Abaixo de `xl`, a lista
vira faixa horizontal com `border-b border-black/20` entre itens; em `xl`,
`flex-col` com `border-l-4 border-l-transparent`.

### 3.3 Coluna de conteúdo

- **Heading** (`page.tsx:802-819`): botão de colapso (`PanelLeftCloseIcon`/
  `PanelLeftOpenIcon`, `hidden xl:inline-flex`), `h1` "Monitoramento da execução
  orçamentária" (`font-heading text-xl font-bold tracking-tight`) e contagem
  `{N} ação(ões)` à direita com `border-l border-black/40 pl-3` (ou "Carregando
  dados do QDD vigente…" enquanto `isLoading`).
- **KPIs globais** (`page.tsx:828-848`): `<dl>` com `grid-cols-2 lg:grid-cols-3
  2xl:grid-cols-6` (6 células: Dotação inicial, Dotação atualizada, Empenhado,
  Liquidado, Pago, Execução). Células com `border-b border-r border-black/20`,
  `last:border-r-0 2xl:border-b-0`. `dt` com rótulo uppercase 0.68rem; `dd` com
  `text-base font-bold tabular-nums truncate` e `title` com o valor completo;
  `Skeleton h-6 w-24` durante o carregamento. A taxa de execução usa 1 casa
  decimal pt-BR.
- **Tabs de visualização**: `Tabs` com `role="group"` e `aria-label` que explica a
  navegação por setas (`page.tsx:853-859`). Conteúdo por aba:

  - `overview`: `Tabs` interno pela dimensão; `geral` renderiza a grade
    `gridClass` (`grid h-full min-h-0 grid-cols-1 gap-2 sm:grid-cols-2
    xl:grid-cols-3 xl:grid-rows-2`) com **6 cards de tipos mistos** (seção 7.7):
    `CycleStackedBarChart` (elemento, fonte), `CycleLineChart` (grupo),
    `ExecutionChartCard` (categoria, modalidade) e `ExecutionScatterChart`
    (órgão). `amendments` renderiza a mesma grade com os 6 recortes de emenda,
    todos `ExecutionChartCard` (os tipos adicionais ficam na dimensão `geral`).
  - `fiscal`: `FiscalSecretariatView` (seção 7.4).
  - `actions`: `OverviewScheduledActionsPanel` com `variant="execution"`
    (seção 7.3).
  - `table`: `Tabs` interno pela dimensão. Em `geral`, as tabelas empilham com
    `flex flex-col gap-2 overflow-y-auto`: elemento, grupo, ação e fonte, todas
    com `STACKED_TABLE_CLASS = 'shrink-0 max-h-[34rem]'` (sem `shrink-0`, cards
    flex com `min-h-0` encolhem até sobrar uma linha visível; o teto faz a
    tabela de ação — 74 registros no QDD atual — rolar por dentro em vez de
    empurrar as demais para fora). Em `amendments`, `grid-rows-2` com as duas
    tabelas (órgão e ação) em `min-h-0 overflow-hidden`.
  - `payroll`: `PayrollPanel` (ou `Skeleton h-96 w-full`).

### 3.4 Rodapé de navegação

`orcamento-view-footer z-10 flex min-h-11 shrink-0 items-stretch justify-between
border-t border-black/70 bg-white` (`page.tsx:1016-1113`):

- **Anterior/Próxima**: `variant="ghost" size="sm"`, `h-auto rounded-none`,
  borda `border-r/border-l border-black/20`, `aria-label` +
  `aria-disabled`; no primeiro/último item, `pointer-events-none opacity-40`.
- **Abas**: container `role="tablist"` com `aria-label="Visualizações da
  execução"` e `overflow-x-auto`; a faixa verde (`bg-green-900`, `inset-y-0`,
  `transition-[left,width] duration-500`) segue o mouse via `useHoverPill` e o
  marcador bege (`bottom-0 h-[3px] bg-[#b8b477]`, `z-20`,
  `transition-[left,width] duration-300`) marca a aba ativa — verde sobre verde
  sumiria, por isso o marcador é bege. Cada botão: `role="tab"`, `aria-selected`,
  `data-hover-tab-value`, `onFocus`/`onMouseEnter` para acender a pílula, `z-10`,
  `border-b-[3px] border-transparent` (reserva de espaço), texto `text-xs
  font-semibold`, branco quando sob a pílula.

### 3.5 Estados da página

- **Sem sessão**: `router.push('/login')` no primeiro `useEffect`.
- **Perfil não-admin**: `router.push('/secretaria')`.
- **Carregando** (`isLoading`): skeleton nos KPIs (`h-6 w-24`), `Skeleton h-96`
  no corpo das abas, botão Atualizar com ícone girando, heading com texto de
  carregamento.
- **Vazio**: cada componente tem seu estado vazio próprio (seção 7) — sempre
  usando `Empty` de `@/components/ui/empty`, com texto concreto em pt-BR.
- **Erro de carga**: `toast.error` com a mensagem da API (o helper `api()` de
  `src/lib/api.ts` lança o `message` do JSON de erro, ou o texto bruto; 401
  limpa a sessão e vai para `/login`).

### 3.6 Responsividade e zoom

| Breakpoint | Comportamento |
|---|---|
| `< sm` | grade 1 coluna; KPIs 2 colunas; trilha vira faixa acima do conteúdo |
| `sm`–`xl` | grade 2 colunas; KPIs 3 colunas; cabeçalho do app sem título longo no `lg` |
| `xl`–`2xl` | layout 3 colunas (trilha + conteúdo), trilha colapsável, grade 3×2; KPIs continuam 3 colunas (6 colunas só em `2xl` — com a trilha lateral, em 1440px cada célula teria ~147px e os valores, que precisam de ~170px, apareceriam cortados) |
| `≥ 2xl` | KPIs 6 colunas |

O zoom de 95% é constante e não responde ao viewport. A decisão de manter o
zoom (seção 9, item 1) deve ser revista apenas se houver medição de uso em
telas pequenas que a justifique — não por preferência estética.

## 4. Contrato visual

### 4.1 Paleta

| Uso | Valor |
|---|---|
| Cabeçalhos de painel, faixa de navegação, título da trilha | `bg-green-900` |
| Marcador de aba ativa, acento bege | `#b8b477` |
| Barras/pizza da execução (5) | `#5f8f70`, `#8fa873`, `#b8b477`, `#110f24`, `#c8c89f` |
| Pizza da folha (10) | as 5 acima + `#365f47`, `#78966a`, `#8c8756`, `#29253d`, `#d8d8bd`, `#6f735a` |
| Fundo de card/painel | `bg-white` |
| Bordas estruturais | `border-black/70` |
| Bordas internas (linhas, células) | `border-black/20`–`/30` |
| Zebra de tabela | `odd:bg-stone-50/60` |
| Fundo de cabeçalho de tabela | `bg-stone-50` |
| Texto secundário | `text-muted-foreground` |
| Base das barras de participação | `bg-muted` / `bg-stone-100` |

Os três tipos de visualização novos (seção 7.7) usam exatamente as mesmas 5 cores
da execução — nunca cores novas fora desta tabela.

Regra: **nenhuma cor fora desta paleta** — em especial nada de azul/roxo/vermelho
de frameworks, nada de `text-primary`/`bg-primary` do tema em elementos de
destaque do módulo.

### 4.2 Tipografia e números

- Rótulos de seção e coluna: `uppercase`, `tracking-[0.08em]` a `[0.12em]`,
  `text-[0.68rem]`, `font-semibold`, `text-muted-foreground`.
- Títulos de painel: `uppercase tracking-wide`, `font-semibold` (branco sobre
  verde).
- Valores monetários: `formatMoney` (`Intl.NumberFormat('pt-BR', BRL, 2 casas)`,
  `src/lib/api.ts:60-67`) para células; `compactMoney` (abreviações `mil`/`mi`/
  `bi`, 1 casa máxima) para eixos de gráfico e listas compactas. **Nenhuma**
  formatação de moeda ad hoc.
- Números: sempre `tabular-nums`; contagens com `toLocaleString('pt-BR')`.
- Título da página: `font-heading text-xl font-bold tracking-tight`.
- Texto de interface: **pt-BR**, sem emojis, sem inglês.

### 4.3 Receitas de componente

- **Painel/card do módulo** (`PANEL_CLASS`, `execution-breakdown-panel.tsx:47-50`):
  `!gap-0 overflow-hidden rounded-none border-black/70 bg-white !py-0 shadow-none`
  com `size="sm"`; cabeçalho (`CHART_HEADER_CLASS`):
  `!mt-0 !rounded-none border-b border-black/70 bg-green-900 px-3 py-2 text-white`.
  O `rounded-none`/`shadow-none` é identidade: o sistema é plano, com bordas
  pretas, sem cantos arredondados e sem sombras.
- **Cabeçalho do app**: descrito em 3.1.
- **KPI**: `dt` uppercase 0.68rem + `dd` bold tabular-nums com `truncate` e
  `title` (acessibilidade para valores cortados).
- **Tabela**: cabeçalho `sticky top-0 z-10 bg-stone-50` com borda inferior
  `border-black/70`; primeira coluna `min-w-[16rem]`; valores à direita
  (`text-right`); coluna da métrica selecionada em destaque (`font-semibold`
  no cabeçalho e nas células).
- **Botões do cabeçalho do app**: `rounded-sm border-black/50 bg-white
  text-foreground shadow-none hover:bg-stone-100`.
- **Estados vazios**: `Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/
  `EmptyDescription` com texto concreto ("Nenhum dado para exibir", "Não há
  registros correspondentes aos filtros aplicados." etc.). Proibido lorem ipsum e
  texto genérico.
- **Loading**: `Skeleton` apenas (sem shimmer, sem spinner além do ícone do
  botão Atualizar).
- **Ícones**: somente `lucide-react`, tamanho `size-4` (ou `size-3.5` em linhas
  compactas), com `data-icon="inline-start"/"inline-end"` para os slots dos
  botões.

### 4.4 Interação (pílula de hover)

O padrão `useHoverPill` (`src/components/ui/tabs.tsx:97-172`) é compartilhado
com os orçamentos temáticos e deve ser **literalmente o mesmo**:

- cada item carrega `data-hover-tab-value`; o container é `relative` e recebe
  `listRef`;
- `pill` segue o mouse/foco (500ms); `activePill` só se move quando a seleção
  muda (300ms) — é isso que faz o marcador deslizar entre itens em vez de saltar;
- `onMouseLeave={resetHighlight}` volta a pílula para o item ativo;
- `ResizeObserver` no container + `window.resize` re-medem as pílulas.

Não substituir por fundos estáticos (`bg-green-900` fixo no item ativo) nem por
`TabsTrigger` puro do Radix nos casos onde hoje se usa o hook — a animação é a
mesma em todo o sistema.

## 5. Dados: carga, tipos e derivações

### 5.1 Rotas e cargas

Todas as rotas de leitura aceitam `?year=` (o seletor da seção 3.1 envia o
exercício selecionado). Sem o parâmetro, o servidor resolve o **exercício
corrente** — o ano mais recente com QDD `VIGENTE` —, de modo que URLs antigas se
comportam exatamente como antes.

| Dado | Rota | Origem |
|---|---|---|
| Ações | `GET /api/budget-actions?year=` | `listActions` (`src/lib/store.ts`) — a importação `VIGENTE` **daquele exercício**; `year` SELECIONA o import, não filtra dentro dele; para admin, aceita ainda `organizationCode` e `unitCode`; inclui `expenseLines` (via `expenseLineSelect`) e `assignments`; ordena por órgão/unidade/projeto-atividade |
| Órgãos | `GET /api/organizations?year=` | cadastro do exercício (`ExerciseOrganization`/`ExerciseUnit`), ordenado por código. **As opções do filtro de órgão não vêm daqui** — veja a seção 9.18 |
| Metadados | `GET /api/metadata?year=` | inclui `exercises`, `currentYear`, `comparisonOnly` e o `vigenteImport` **do exercício selecionado** |
| Folha | `GET /api/payroll` | `PayrollSnapshot` mais recente (`orderBy year desc, month desc`) com `groups`; rota restrita a `SEPLAN_ADMIN`; devolve só somas, agrupadas por `dimension` e ordenadas por `grossTotal` desc (`src/app/api/payroll/route.ts`) |

### 5.2 Formato dos dados

`BudgetAction` (`src/types/domain.ts:168-190`) traz: identificadores (org/unit
com código e nome), `application`, `functionalProgram`, `projectActivity`,
`totals` (7 valores: `initialBudget`, `supplemented`, `updatedBudget`,
`committed`, `liquidated`, `paid`, `available`), `expenseLinesCount`,
`expenseLines?: ExpenseLine[]` e `assignments` (usadas apenas pelo painel de
ações). `mapAction` (`src/lib/store.ts:403-439`) aplaina os totais do banco para
esse formato e deduplica marcações por tema.

`ExpenseLine` (`domain.ts:192-214`): além dos identificadores, `expenseAccount`
(natureza em 6 posições), `expenseDescription`, `reduced`, `source` e 10 valores
(inclui `payableToLiquidate` e `payable`, que **não** são exibidos no módulo —
não adicionar colunas com eles sem atualizar a seção 4).

### 5.3 Estado da página e derivações

Todos os `useMemo` da página e o que os invalida:

| Derivação | Depende de | Propósito |
|---|---|---|
| `organizationOptions` | `organizations` | opções do combo de órgão |
| `fiscalOrganizationOptions` | `organizations` | opções da visão por órgão ("Selecione uma secretaria") |
| `unitOptions` | `actions`, `organizationCode` | unidades do órgão selecionado |
| `sourceOptions` | `actions`, `organizationCode`, `unitFilter` | fontes das ações do recorte órgão+unidade |
| `filteredActions` | 6 filtros + `actions` | recorte aplicado às abas de gráfico/tabela/ações |
| `totals` | `filteredActions` | KPIs globais |
| `fiscalActions` | `actions`, `organizationCode`, `unitFilter` | recorte da visão por órgão (sem fonte/função/busca) |
| `selectedOrganization` | `organizations`, `organizationCode` | objeto do órgão na visão fiscal |
| `fiscalPayrollHeadcount` | `payroll`, `organizationCode`, `unitFilter` | vínculos da folha no escopo do órgão (seção 6.6) |
| `personnelScope` | `actions`, `fiscalActions`, `selectedOrganization`, `unitFilter` | ações locais vs. folha centralizada (3 casos, abaixo) |
| `elementRows`…`sourceRows` | `filteredActions` | agregações da dimensão `geral` |
| `amendments` + 6 agregações | `filteredActions` | recortes da dimensão `emendas` |
| `hasFilters` | 6 filtros | habilita "Limpar filtros" |
| `contentViewPill` | `contentView` | hook de pílula do footer (não é memo) |
| `rate` | `totals` | % de execução dos KPIs |

`personnelScope` resolve o problema "o pessoal da secretaria está em ações
próprias e na folha centralizada da SEAD" em três casos (`page.tsx:455-527`):

1. sem unidade selecionada → consolida secretaria + unidades vinculadas, nota
   "Consolidação no nível da secretaria.";
2. unidade com ação própria na folha centralizada (encontrada por
   `centralPayrollActionsForTargets`) → recorte da unidade, nota "A unidade
   possui ação própria identificada na folha centralizada.";
3. unidade sem ação própria → consolida a secretaria inteira, nota "A unidade
   não possui ação própria na folha; por isso, pessoal é apresentado no nível da
   secretaria, sem rateio."

### 5.4 Filtros — normalizações

- `normalize(value)` (`page.tsx:206-211`): NFD + remove combining marks +
  minúsculas — usada na busca.
- `normalizeSourceCode(value)` (`page.tsx:213-216`): remove não-dígitos; se
  resultar vazio, mantém o texto cru. A mesma normalização é aplicada no filtro
  e na derivação de `sourceOptions`, garantindo que `15001002` e `15.001.002`
  sejam a mesma fonte.
- `actionMatchesFunctionalFilters` (`src/lib/functional-classification.ts:254-270`):
  filtra por função e subfunção extraídas de `functionalProgram`/
  `projectActivity`; subfunção só é considerada com função selecionada.

## 6. Contrato de cálculos

### 6.1 Execução

- **`executionRate(liquidated, updatedBudget)`** = `liquidated ÷ updatedBudget ×
  100`, com guarda `!updatedBudget → 0` (`execution-monitor.ts:184-187`). A base
  é a dotação **atualizada** (orçamento vigente, com suplementações) — diferente
  dos orçamentos temáticos, que medem sobre a **inicial**
  (`thematicBudgetContribution`, `src/lib/classification-rules.ts`). As duas
  taxas não são comparáveis; não "unificar".
- **`ExecutionMetric`**: exatamente `initialBudget`, `updatedBudget`,
  `committed`, `liquidated`, `paid`, nessa ordem (ciclo da despesa:
  dotação → empenho → liquidação → pagamento). `available` existe em
  `ExecutionTotals` mas **não** é selecionável — aparece apenas nos KPIs da
  visão por órgão. Toda `ExecutionRow` já carrega os cinco valores; trocar a
  ótica é escolher qual campo ler, nunca recalcular (`execution-monitor.ts:152-174`).

### 6.2 Natureza da despesa (`src/lib/expense-nature.ts`)

- Formato no QDD: `expenseAccount` com seis grupos separados por espaço, ponto
  ou hífen: `3 1 90 13 00 00` = categoria `3` (corrente), grupo `1` (pessoal),
  modalidade `90` (aplicação direta), elemento `13` (obrigações patronais),
  subelemento `00.00`.
- **`parseExpenseAccount`**: retorna `null` se o código não tiver as 4 primeiras
  posições numéricas — sem elas não há elemento.
- **Por que o parser existe**: agrupar pelo código cru misturaria 110 códigos
  completos em apenas 53 elementos. Os catálogos `EXPENSE_CATEGORIES`,
  `EXPENSE_GROUPS`, `EXPENSE_MODALITIES`, `EXPENSE_ELEMENTS` cobrem os 53
  elementos presentes no QDD vigente e o restante da tabela STN/SOF (para
  importações futuras não quebrarem).
- Nome de elemento com fallback: `expenseElementName(code, fallback)` usa o
  catálogo; fora dele, o fallback é a descrição limpa do QDD
  (`cleanExpenseDescription` em `src/lib/expense-breakdown.ts:18-24`, que remove
  caudas truncadas terminadas em hífen, ex.: `"…TERCEIROS - PES-"` →
  `"…TERCEIROS"`).

### 6.3 Agregações — regras de bucket e fechamento

`src/lib/execution-monitor.ts` (todas puras, todas devolvem `ExecutionRow[]`
com `{ key, label, shortLabel, chartLabel?, count, executionRate, ...totals }`):

| Agregação | Nível (fonte dos dados) | Regra do bucket |
|---|---|---|
| `aggregateByElement` | linha (`expenseLines`) | elemento (pos. 4); natureza ilegível → `SEM_CLASSIFICACAO`/`Sem classificação` |
| `aggregateByGroup` | linha | grupo (pos. 2); catálogo `EXPENSE_GROUPS` |
| `aggregateByCategory` | linha | categoria (pos. 1); catálogo `EXPENSE_CATEGORIES` |
| `aggregateByModality` | linha | modalidade (pos. 3); catálogo `EXPENSE_MODALITIES` |
| `aggregateBySource` | linha | `source` cru (trim); rótulo via `getFonteLabel`; vazio → `Sem fonte` |
| `aggregateByOrganization` | ação (`totals`) | código do órgão; rótulo `{código} — {nome}`; `chartLabel` = sigla (`organizationAcronym`) |
| `aggregateByAction` | ação | `action.id`; rótulo `{projectActivity} — {application}` |

Regras transversais:

1. **Nada pode sumir**: linhas que não casam nenhum bucket caem em buckets
   explícitos (`SEM_CLASSIFICACAO`, `Sem fonte`). A soma dos buckets de qualquer
   agregação deve fechar com o total geral das ações de entrada.
2. **`finish()`**: calcula `executionRate` por bucket e ordena por `liquidated`
   desc. A UI reordena pela métrica escolhida (`sortByMetric`) — não mudar a
   ordenação de saída das agregações, pois outros consumidores (tabelas) também
   reordenam.
3. **Contagem**: `count` é nº de linhas para agregações por linha e nº de ações
   para agregações por ação — o rótulo da coluna (`countLabel`) tem que casar.

`getFonteLabel` (`src/lib/fontes-recursos.ts:111-125`): normaliza o código
removendo não-dígitos, consulta o catálogo direto e, para grupos `2`
(superávit) e `3` (condicionados), deriva do equivalente do exercício corrente
(grupo `1`) — ex.: `27130700` → "…FSP — superávit de exercícios anteriores".
Sem isso, 33 das 40 fontes não catalogadas do QDD vigente apareceriam como "Fonte
não catalogada". A base do catálogo é o Anexo das Fontes ou Destinações de
Recursos 2026 da SEPLAN/DIRPLA/DEPOP.

### 6.4 Emendas parlamentares

- **Identificação** (`actionIsAmendment`, `functional-classification.ts:249-252`):
  `projectActivity` começa com `8` e não está em `AMENDMENT_DEBT_CONTROL_CODES`
  (= `80000000` + faixa `80010000`–`80270000`, 27 códigos de controle da dívida
  do Estado — não são emendas).
- **Recortes**: a dimensão `Emendas` calcula **todos** os recortes somente sobre
  `amendmentActions(filteredActions)` — é isso que torna os gráficos informativos
  em vez de repetição das abas gerais (`page.tsx:537-547`).
- **Tipo da emenda** (`amendmentTypeFromSource`, `execution-monitor.ts:463-471`):
  deduzido do rótulo da fonte (`getFonteLabel`) — "emenda" + individua/bancada/
  comiss/relator. Só funciona para emendas **federais** (as catalogadas nas
  fontes); emendas do tesouro estadual caem em `NAO_IDENTIFICADO` — limitação do
  dado de origem, não do cálculo. `aggregateAmendmentsByType` percorre linhas
  (o tipo está na fonte, que está na linha).

### 6.5 Visão por órgão (`fiscal-secretariat-view.tsx`)

- **Orçamento Comprometido (%)**: soma de linhas cuja fonte (normalizada) está em
  `[15000100, ...EARMARKED_SOURCES_BY_ORGANIZATION[org]]`; taxa =
  `committed ÷ updatedBudget`. A lista de fontes vinculadas é **por órgão** e
  deliberada (hoje: `721` → `15001002`, `16000400`; `719` → `17530700`,
  `17130700`, `27130700`, `17520700`). Motivo documentado no código: a SESACRE
  tem ~R$ 28 mi na fonte 100 contra ~R$ 841 mi nas vinculadas da saúde — medir
  só pela 100 marcaria 10,7% quando o número real passa de 70%. As mesmas fontes
  aparecem em outros órgãos (ex.: `15001002` na SEAD, ~R$ 962 mi, e na SEFAZ,
  ~R$ 41 mi; `17530700` no Meio Ambiente e nas polícias) sem entrar no indicador
  deles — incluir alteraria indicadores sem relação com a finalidade da
  vinculação. **O texto de ajuda do KPI é gerado** a partir das fontes reais do
  órgão (`commitmentHelpText`, `fiscal-secretariat-view.tsx:405-417`), nunca
  escrito à mão — para não mentir quando a lista mudar.
- **Índices de execução**: Empenho e Liquidação sobre a dotação atualizada;
  **Pagamento sobre o liquidado** (`safeRate(paid, liquidated)`) — bases
  diferentes por definição de cada ato (comprometer ≠ executar ≠ pagar).
- **Pessoal consolidado**: `personnelTotalsOf` (seção 6.6) aplicada a
  `localPersonnelScope` (ações do órgão **menos** as centralizadas) e a
  `centralPayrollActions`; totais somados; participação no orçamento =
  `updatedBudget(pessoal) ÷ (updatedBudget(ações locais) + updatedBudget(folha
  centralizada))`.
- **Menores índices de execução**: ações não-emenda com `updatedBudget > 0`,
  ordenadas por taxa asc e dotação desc, top 8 — um alerta prático, não um
  ranking estatístico.
- **Composição**: unidades (quando nenhuma unidade selecionada), categorias e
  fontes em barras de participação (top 5, `MiniBarList`).
- **Apresentação**: "Apresentar" entra em fullscreen da seção
  (`requestFullscreen`/`exitFullscreen`); "Imprimir / Salvar PDF" chama
  `window.print()`. As seções marcam `fiscal-print-section`.

### 6.6 Folha de pagamento

**Custo de pessoal no QDD** (`personnelTotalsOf`, `execution-monitor.ts:320-341`):

- todas as linhas de GND 1; **mais**
- linhas de GND 3 (correntes) com elemento em
  `PAYROLL_RELATED_CURRENT_EXPENSE_ELEMENTS = {08, 13, 36, 46, 47, 48, 49, 92,
  93, 94}` (auxílios, benefícios, verbas indenizatórias, DEA, obrigações
  patronais) **somente quando** a ação tem `folha de pagamento` na aplicação
  normalizada. A restrição pela ação evita classificar auxílios de políticas
  finalísticas como despesa de pessoal.

**Folha centralizada** (`isCentralPayrollAction` + `CENTRAL_PAYROLL_SCOPES`,
`execution-monitor.ts:242-305`):

- são centrais as ações nas unidades `714/002` (SEAD) e `714/607`
  (SESACRE/FUNDES) com "folha de pagamento" na aplicação;
- a vinculação da ação à secretaria usa o mapa auditado de códigos de
  projeto/atividade (`20260000` SEGOV … `23090000` SEPI; `null` para
  `20530000` — pensões dos hansenianos, GND 3 — e `80000000` — inativos e
  pensionistas, sem rateio). **Sem rateio e sem aproximação textual**: nomes e
  vínculos administrativos mudam no exercício; o código da ação não. O fallback
  textual (nome ≥ 6 caracteres ou sigla como palavra, com acento normalizado)
  existe para alvos que não têm ação nominal — mas só depois do mapa.

**Vínculos na folha** (`src/lib/payroll-scope.ts`):

- `PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE`: associação auditável
  `"{org}/{unit}"` → nomes do portal (ex.: `721/001` → `SECRETARIA DE ESTADO DE
  SAUDE`, `721/302` → `HOSPITAL DAS CLINICAS DO ACRE`). O portal publica por
  nome, sem os códigos do QDD — o mapa evita que aproximação textual atribua
  vínculos a unidade errada.
- `payrollHeadcountForQddScope`: `null` sem snapshot/órgão; `714|002` →
  folha estadual consolidada (`isStatewidePayroll`); senão, resolve os aliases
  do escopo (todas as unidades do órgão, ou a unidade exata), normaliza nomes
  (sem acento, caixa alta, espaços colapsados) e cruza com `byOrganization`.
- **Inativos**: vínculos cujo `secondaryKey`/nome contém APOSENT/PENSION/INATIV
  são excluídos da contagem de ativos e reportados à parte
  (`excludedInactiveHeadcount`). Inatividade não é deduzida do tipo de contrato
  (escapariam ~14,5 mil aposentados cadastrados como EFETIVO) nem do órgão
  (entrariam ~48 servidores que de fato trabalham no Instituto de Previdência e
  ficariam de fora ~690 inativos lotados noutros órgãos) — a situação vem do
  campo `situacao` do portal.

**Coleta** (`src/lib/payroll-portal.ts`, `scripts/collect-payroll.mjs`):

- o portal (Laravel + DataTables) não tem API documentada; a coleta abre sessão
  (`GET /servidores`, extrai `csrf-token` e cookies), e varre
  `POST /servidores/listar` por tipo de contrato — o campo `contrato` da linha
  **não** é o tipo, é o nº sequencial do vínculo; por isso uma consulta por
  tipo. `CONTRACT_TYPES`: COMISSÃO, CONTRATO CLT, EFETIVO, EFETIVO/COMISSÃO,
  ELETIVO, ESTAGIÁRIO, PENSIONISTA, TEMPORÁRIO.
- parâmetros da varredura: `PAGE_SIZE = 5000` (responde em ~4s; acima disso o
  payload pesa), `REQUEST_DELAY_MS = 700` entre requisições, retry
  `MAX_TENTATIVAS = 4` com backoff 2s/4s/8s e `TIMEOUT_MS = 120_000`
  (`collect-payroll.mjs:67-86` — o portal derruba conexões esporádicas em
  páginas grandes; sem retry, uma falha isolada perderia a coleta inteira).
- **privacidade**: a resposta traz nome/matrícula; nada sai do script — só
  somas por tipo, órgão, carreira (com `situacao` em `secondaryKey`) e
  cruzamento órgão×tipo são persistidas. `USER_AGENT` identifica o coletor.
- **auditoria**: `portalHeadcount` (total sem filtro do portal) é gravado junto;
  a diferença para `headcount` (vínculos sem tipo de contrato definido, não
  isoláveis — filtrar tipo vazio devolve a base inteira) aparece no painel. Em
  01/2026 a diferença era de 2 em 53.985.
- **idempotência/atomicidade**: transação — `deleteMany` do mês + `create` do
  snapshot + `createMany` dos grupos; ou o mês novo entra completo, ou o
  anterior permanece. Recoletar o mesmo mês apenas substitui.

## 7. Componentes do módulo

### 7.1 `ExecutionChartCard` (`execution-breakdown-panel.tsx:110-206`)

Props: `title`, `rows: ExecutionRow[]`, `metric: ExecutionMetric`,
`description?`, `color = 'var(--chart-1)'`, `className?`.

Mecânica (toda memoizada):

1. `chartData = sortByMetric(rows, metric)` → filtra `row[metric] > 0` →
   `slice(0, CHART_MAX_ROWS = 100)` → mapeia `tick` (limite de segurança para
   não renderizar milhares de barras num SVG).
2. `chartTick(row)`: usa `chartLabel` se houver; senão prefixa a chave quando
   `key.length <= 8 && key !== shortLabel` (ex.: `"13 Obrigações Patronais"` —
   sem o prefixo, nomes longos truncam no mesmo texto e as barras ficam
   indistinguíveis); trunca em `AXIS_TICK_MAX_CHARS = 18`. O corte é sobre o
   texto inteiro porque o Recharts quebra o tick em várias linhas ao passar da
   largura do eixo, sobrepondo barras vizinhas; 18 é calibrado para caber em uma
   linha no eixo de `AXIS_WIDTH = 120` com fonte 10.
3. `axisWidth = min(120, max(52, ceil(maiorTick × 5.4 + 10)))` — aproxima a
   largura necessária do texto.
4. `chartConfig` = `{ [metric]: { label, color } }` — a chave precisa casar com
   o `dataKey` para o tooltip resolver o rótulo.
5. Recharts: `BarChart layout="vertical"`, `margin {top:2,right:12,left:2,
   bottom:2}`, `barCategoryGap="16%"`; `XAxis type="number"` com
   `tickFormatter = compactMoney` (fonte 10); `YAxis type="category"
   dataKey="tick"` com `interval={0}` (fonte 10); tooltip com valor via
   `formatMoney` e rótulo via `row.label` completo; `Bar` com `radius={0}`.
6. Altura do container: `max(170, chartData.length × 26 + 34)` — 26px por barra
   mais folga.
7. `rows.length === 0` (após filtro) → `EmptyState`.

### 7.2 `ExecutionTablePanel` (`execution-breakdown-panel.tsx:243-329`)

Props: `title`, `description`, `rows`, `metric`, `entityLabel` (cabeçalho da 1ª
coluna), `countLabel` ("Linhas"/"Ações"), `moneyColumns = MONEY_COLUMNS`
(padrão: Dotação inicial, Atualizada, Empenhado, Liquidado, Pago — a ordem é o
ciclo da despesa), `hideRate = false`, `className?`.

Mecânica:

- reordena por `metric`; cabeçalho mostra "N registros" no título (substituiu o
  antigo botão "Mostrar todos os N" quando a rolagem entrou);
- container interno `max-h-[26rem] overflow-auto` (teto próprio: onde o pai não
  limita altura, a tabela cresceria indefinidamente; onde o pai limita, prevalece
  o menor) com cabeçalho `sticky`;
- coluna da métrica em destaque; zebra `odd:bg-stone-50/60`; coluna de execução
  (`executionRate`, 1 casa) ocultável via `hideRate` (usado pela folha, onde
  percentual de execução não faz sentido);
- `moneyColumns` permite a folha reutilizar o componente com os próprios
  cabeçalhos (Bruto/Descontos/Líquido).

### 7.3 `OverviewScheduledActionsPanel` (`overview-scheduled-actions-panel.tsx`)

Compartilhado com os orçamentos temáticos; no módulo é usado com
`variant="execution"`, `actions={filteredActions}` e `organizations`. O variant
adapta o painel para receber filtros externos (órgão, função, subfunção, busca)
em vez de expor os próprios. O painel e a linha da tabela (`OverviewActionRow`,
linha 98) são `memo` — a lista chega a milhares de linhas. Não criar um painel
de ações paralelo para o módulo; evoluir este.

### 7.4 `FiscalSecretariatView` (`fiscal-secretariat-view.tsx`)

Props (todas obrigatórias exceto `organization`): `actions`, `personnelActions`,
`centralPayrollActions`, `personnelScopeLabel`, `personnelScopeNote`,
`organization?`, `organizationCode`, `organizationOptions`, `unitFilter`,
`unitOptions`, `payrollHeadcount: PayrollHeadcountScope | null`, `allValue`,
`onOrganizationChange`, `onUnitChange`, `vigenteImport?`.

Layout (cabeçalho fixo + conteúdo rolável):

1. **Cabeçalho**: título "Visão fiscal da execução", órgão selecionado,
   `periodLabel(vigenteImport)` ("Acumulado até {mês} de {ano}" para
   `ACUMULADO_ANUAL`; "Mês de {mês} de {ano}" para `MES_ISOLADO`), unidade
   selecionada e nº de ações no recorte; botões "Apresentar" (fullscreen) e
   "Imprimir / Salvar PDF"; seletores de Secretaria e Unidade
   (`SearchableCombobox`, unidade desabilitada sem órgão).
2. **KPIs** (`grid-cols-2 md:grid-cols-4 2xl:grid-cols-7`): 6 estágios +
   Orçamento Comprometido (%) com `FiscalKpi` (tooltip de cálculo via
   `InfoIcon` + `aria-label` "Como é calculado: …").
3. **Execução da despesa**: estágios (Atualizado/Empenhado/Liquidado/Pago como
   barras sobre a dotação atualizada) + índices (Empenho, Liquidação, Pagamento)
   com detalhe da base.
4. **Despesas com pessoal**: escopo (rótulo + nota passados pela página),
   vínculos ativos por contrato (`payrollHeadcount.contracts`, com share e
   inativos excluídos à parte), cartão "Vínculos ativos na folha" (número grande
   verde; "Não identificado" quando `headcount === null`; `title` com as
   correspondências achadas no portal), métricas
   (no próprio órgão / folha centralizada SEAD / total atualizado / empenhado /
   liquidado / pago) e indicador de participação no orçamento. Sem dados →
   estado vazio explicando que não há GND 1 nem ação nominal na folha
   centralizada.
5. **Composição do orçamento**: unidades (só sem unidade selecionada),
   categorias, fontes — `MiniBarList` top 5 por dotação atualizada.
6. **Ações orçamentárias**: maiores orçamentos atualizados + menores índices de
   execução (8, sem emendas).

Regra interna: **nenhum cálculo no componente que já existe em
`execution-monitor.ts`** — ele importa `aggregateByCategory`,
`aggregateBySource`, `aggregateByAction`, `personnelTotalsOf`, `totalsOf`,
`executionRate`, `isCentralPayrollAction`. A exceção é `aggregateByUnit`, que é
local (só existe nesta visão).

### 7.5 `PayrollPanel` (`payroll-panel.tsx`)

Props: `data: PayrollDto`. Sem snapshot → `Empty` "Folha ainda não coletada"
(com a explicação de que a coleta roda diariamente e pode ser disparada no
GitHub). Com snapshot:

- **Cabeçalho**: período ("{mês} de {ano}", capitalize), data da coleta, fonte
  ("Portal da Transparência do Acre"), selo "Somente dados agregados" e aviso de
  vínculos sem tipo definido quando `portalHeadcount > headcount`.
- **Sumário** (`grid-cols-2 lg:grid-cols-4`, divisores `bg-black` com
  `gap-px`): Vínculos classificados, Folha bruta, Descontos, Folha líquida.
- **Distribuição por órgão**: pizza top 9 + fatia "Demais órgãos (N)"; tooltip
  com share e vínculos; legenda com quadrados de cor e share.
- **Distribuição da folha** (`xl:grid-cols-3`): por tipo de vínculo (barras top
  8), por órgão (barras top 8), maiores carreiras por rendimento médio.
- **Detalhamento** (`2xl:grid-cols-[0.9fr_1.4fr]`): totais por tipo de vínculo
  (tabela completa, 4 colunas: tipo, vínculos, bruto, descontos, líquido) e
  maiores folhas por órgão e vínculo (top 12, colunas órgão/tipo/vínculos/bruto).

**Ranking de carreiras**: agrupa `byCareer` (carreira + `secondaryKey` =
situação crua do portal) em famílias via `careerFamilyLabel`
(`payroll-panel.tsx:106-139` — remove CLASSE/NÍVEL/jornada/senioridade,
normaliza "ESPEC."/abreviações, colapsa professores em "PROFESSOR"). O portal
grava a mesma carreira de apoio das duas formas — `APOIO ADMIN. NIVEL I 25H -
CLASSE I` e `APOIO ADMINISTRATIVO NIVEL I 25H` —, então a regra casa os dois
prefixos (`^APOIO\s+ADMIN(?:\.|ISTRATIVO)`) e rotula a família como **APOIO
ADMINISTRATIVO EDUC.**: a quase totalidade desses vínculos vem do quadro da
educação. As duas grafias já caíam na mesma família antes da renomeação; separá-
las mudaria a média, não só o rótulo. Padrão:
só `secondaryKey === 'ATIVO'`; toggle "Incluir inativos" (`role="switch"`,
`aria-checked`) mostra o quadro completo com aviso de
`inactiveHeadcount` ocultos. A média é `grossTotal ÷ headcount` da família; o
`title` mostra o nº de denominações consolidadas quando > 1.

Abaixo do cabeçalho há uma **busca por carreira** (`Input` + `SearchIcon`
absoluto com `pl-8`, a mesma receita dos demais campos de busca do módulo; sem
rótulo visível, com `aria-label`). O casamento é por `includes` sobre
`careerFamilyKey(busca.toUpperCase())` contra a `key` da família — a mesma
normalização dos dois lados, sem acento nem pontuação; o `toUpperCase()` é
obrigatório porque `careerFamilyKey` descarta minúsculas. Sem resultado: "Nenhuma
carreira corresponde à busca." **dentro** do retorno principal, com o campo ainda
visível (o `return` antecipado de lista vazia é só para o caso de não haver
carreira alguma). O contador do cabeçalho passa a "X de Y carreiras" enquanto a
busca estiver preenchida.

### 7.6 Reuso externo ao módulo

- `Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`
  (`components/ui/empty`), `Skeleton`, `Card`/`CardHeader`/`CardTitle`/
  `CardDescription`/`CardContent`, `Table*`, `Select*`, `Button`, `Field`,
  `Input`, `Tooltip` — todos de `components/ui/*`.
- `SearchableCombobox` — combo com busca, usado em órgão/unidade/fonte e nos
  seletores da visão fiscal.
- `FunctionalClassificationFilters` — filtros de função/subfunção.
- `useHoverPill` — pílula das navegações (seção 4.4).
- `formatMoney`, `api`, `getStoredSession`, `clearStoredSession` — de
  `src/lib/api.ts`.
- `organizationAcronym` (`src/lib/organization-acronym.ts`): sigla via override
  (11 códigos: 101 ALEAC, 102 TCE, 203 TJAC, 304 MPAC, 305 DPE, 444 REPAC,
  446 SECC, 447 CASMIL, 450 GABVICE, 452 CEPDEC, 720 SEMA) ou extração do trecho
  após " - " (CAIXA ALTA, ≤ 12 chars); sem derivação possível → código.

### 7.7 Tipos de visualização adicionais da grade (Visão geral)

A grade `geral`/`amendments` da Visão geral pode misturar **quatro** tipos de
visualização, todos sobre as mesmas `ExecutionRow[]` das agregações (seção 6.3),
todos no mesmo shell de card da seção 4.3 (`PANEL_CLASS`, `CHART_HEADER_CLASS`,
`rounded-none`, `shadow-none`), todos `memo` (R4) e todos com as 5 cores da
paleta da seção 4.1:

1. **`ExecutionChartCard`** — barras horizontais de uma série (seção 7.1). O tipo
   original; continua sendo o padrão para recortes com muitos itens.
2. **`CycleStackedBarChart`** — **barras empilhadas do ciclo da despesa**: uma
   barra por recorte (por `updatedBudget`) dividida em 4 segmentos derivados, sem
   recalcular agregação:
   - `Não empenhado` = `updatedBudget − committed`;
   - `Empenhado não liquidado` = `committed − liquidated`;
   - `Liquidado não pago` = `liquidated − paid`;
   - `Pago` = `paid`.
   Usa `BarChart layout="vertical"` com `stackId` e 4 `Bar` com as cores da
   paleta. Responde "quanto do dinheiro já percorreu o ciclo".
3. **`CycleLineChart`** — **curva do ciclo**: eixo X com os 5 estágios
   (`EXECUTION_METRICS`, ordem do ciclo da despesa), eixo Y com o valor; uma
   linha por item do top-N (padrão 8) por `updatedBudget`. Usa `LineChart` do
   Recharts com `Line` (sem gradiente). Mostra o "atrito" da execução ao longo do
   ciclo.
4. **`ExecutionScatterChart`** — **dispersão dotação × execução**: X =
   `updatedBudget`, Y = `executionRate` (%), tamanho da bolha = `paid`. Usa
   `ScatterChart` + `Scatter` + `ZAxis` do Recharts. Localiza "orçamento grande
   com execução baixa".

**Regras dos tipos novos** (todas derivadas do contrato existente):

- Nenhum deles introduz cor, raio, sombra, gradiente ou biblioteca fora da
  seção 4/10.
- `compactMoney` e `chartTick` (seção 7.1) são reutilizados para eixos e rótulos.
- `EmptyState` é usado quando não há dados após os filtros.
- A seleção de qual recorte usa qual tipo é uma decisão de layout da página
  (seção 3.3), não um comportamento fixo de cada componente.

## 8. Coleta da folha — job

`.github/workflows/folha.yml`:

- `schedule: cron '30 7 * * *'` (07:30 UTC = 04:30 America/Rio_Branco) +
  `workflow_dispatch` com inputs `ano`/`mes`;
- `concurrency: group coleta-folha, cancel-in-progress: false` (nunca cancelar a
  coleta em andamento);
- `timeout-minutes: 20` (a varredura faz ~16 requisições com pausa; sobra folga);
- steps: checkout → setup-node 22 com cache → `npm ci` → `prisma generate` →
  `node apps/web/scripts/collect-payroll.mjs` com `DATABASE_URL` do secret.

`collect-payroll.mjs` (CLI, idêntico em lógica ao `payroll-portal.ts` mas
autônomo — roda fora do Next):

- `--ano`/`--mes` opcionais; sem eles, `mesMaisRecente` (6 meses de lookback);
- sem dados → `process.exit(1)` sem gravar; coleta vazia → `process.exit(1)`;
- log por tipo de contrato e conferência final (`portalHeadcount`); grava em
  transação (seção 6.6).

Regra de manutenção: **as duas implementações (lib e script) devem continuar
idênticas em comportamento**. Mudar a varredura exige mudar as duas. Se um dia
isso doer, o refactor certo é extrair um módulo compartilhado `server-only` — e
documentar aqui.

## 9. Decisões deliberadas (não "corrigir")

1. **Zoom de 95%** (`PAGE_ZOOM`): aumenta a área útil em telas menores. É
   intencional e constante.
2. **Grade 3×2 degradando para 2 e 1 colunas**: abaixo de ~330px por célula, um
   gráfico com eixo de categorias fica ilegível.
3. **Tabelas empilhadas com `shrink-0 max-h-[34rem]`** e teto interno
   `max-h-[26rem]`: sem `shrink-0`, cards flex com `min-h-0` encolhem até sobrar
   uma linha visível; os tetos fazem as tabelas rolarem por dentro.
4. **Ticks truncados em 18 caracteres** (`AXIS_TICK_MAX_CHARS`) com largura de
   eixo estimada (`longestTick × 5.4 + 10`, limitada a 120px): calibração
   medida contra a sobreposição real do Recharts, não um chute.
5. **Gráficos `layout="vertical"`**, `barCategoryGap="16%"`, máximo de 100
   barras, omissão de valores zero na métrica escolhida, altura
   `max(170, n × 26 + 34)`.
6. **KPIs globais em 6 colunas só a partir de `2xl`**: em 1440px com a trilha
   lateral, cada célula teria ~147px e os valores (~170px) cortariam.
7. **Dimensões fundidas em `Geral`/`Emendas`**: antes havia uma dimensão por
   recorte (elemento, ação, fonte) exibindo os mesmos gráficos em ordens
   diferentes; foram fundidas e as tabelas de todos os recortes convivem
   empilhadas na aba `Tabela`. Não recriar dimensões por recorte.
8. **`Órgão` e `Folha` sem trilha de filtros**: visões executivas; os filtros
   do QDD não se aplicam à folha e a visão por órgão tem os próprios seletores.
9. **Ranking de carreiras consolida classes/níveis/jornadas** em famílias —
   "PROFESSOR CLASSE II NÍVEL 4" viraria 4 linhas sem isso.
10. **Inativos ocultos por padrão no ranking** (distorcem a média com proventos
    de inatividade), com toggle explícito.
11. **Matching da folha por nome normalizado + mapa auditável**: o mapa
    `PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE` existe para o nome nunca ser
    adivinhado; a normalização é só para casar o que já está no mapa.
12. **`portalHeadcount` visível quando difere de `headcount`**: ocultar a
    diferença seria mentir sobre os dados.
13. **Texto de ajuda do "Orçamento Comprometido" gerado das fontes reais** —
    nunca texto fixo, senão mentira a cada órgão novo na lista.
14. **`SEM_CLASSIFICACAO`/`Sem fonte` visíveis nas agregações**: um QDD com
    código fora do padrão deve aparecer, não sumir.
15. **Ordem das abas e das métricas é o ciclo da despesa** (dotação → empenho →
    liquidação → pagamento) — não reordenar alfabeticamente ou por tamanho.
16. **A busca do ranking de carreiras não reescala as barras nem recolore a
    lista.** A largura continua medida contra o maior rendimento médio do
    ranking **inteiro** (`highestAverage` de `rankedRows[0]`, não do resultado
    filtrado) e a cor vem do `rank` gravado na linha, não da posição no filtro.
    Buscar uma carreira do fim da lista mostra, portanto, uma barra curta: é o
    valor dela perto do topo do estado, e é o ponto de comparação. Reescalar
    para o filtro faria a mesma carreira mudar de tamanho conforme o que se
    digita, e recolorir por índice embaralharia a lista a cada tecla.
17. **A grade da Visão geral mistura tipos de visualização** (seção 7.7):
    barras de uma série, barras empilhadas do ciclo, curva do ciclo e dispersão
    dotação × execução. A escolha de qual recorte usa qual tipo é deliberada e
    fica registrada na seção 3.3 — não é um comportamento aleatório nem uma
    troca por preferência estética. Nenhum tipo novo pode entrar sem passar por
    esta seção.

18. **As opções do filtro de órgão vêm das ações, não do cadastro.** Unidade e
    fonte sempre derivaram das `actions`; o órgão vinha de `/organizations`. Com
    vários exercícios isso passou a divergir: o cadastro de um ano ofereceria
    órgãos inexistentes no exercício carregado e omitiria os que só existem nele.
    O nome do cadastro continua preferido quando há; senão vale o do próprio QDD
    (`action.organizationName`).
19. **A folha NÃO acompanha o exercício.** `/api/payroll` segue devolvendo o
    snapshot mais recente do Portal da Transparência, qualquer que seja o
    exercício selecionado. É decisão de produto: a folha é o retrato do mês
    publicado, não um recorte do QDD.
20. **`aggregateBySource`/`amendmentTypeFromSource` deduzem o exercício das
    próprias ações** (`actions[0].year`). Todas as ações de uma chamada vêm de um
    único QDD, então a primeira já responde — e o ano não precisa ser propagado
    por prop em toda a árvore de componentes.
21. **Quando a operação conhece o próprio exercício, ela vence o seletor.** A
    conferência de uma prévia de QDD deriva o exercício da própria prévia
    (`importRecord.year`) e **ignora** o `?year=`; a importação usa o campo
    "Exercício" do formulário, porque é a única operação que mira um exercício que
    ainda não existe. O seletor decide apenas onde a operação não sabe — e nesses
    casos o alvo é exibido no ponto da ação, não só no cabeçalho. Deixar o ano do
    contexto governar uma escrita já produziu um diff que sobrescreveria o cadastro
    de um exercício com o de outro.
22. **O exercício corrente é ato de governança, não navegação.** Trocá-lo (tela
    Exercícios, em Estrutura vigente) muda quem pode escrever: as secretarias só
    editam entregas do corrente. Por isso a troca pede confirmação e nunca é efeito
    do seletor do cabeçalho.
23. **Leituras toleram exercício inexistente, escritas não.** Um link antigo com
    `?exercicio=` de um ano que não existe abre no corrente em vez de quebrar; uma
    rota de escrita sem exercício, ou com um inexistente, é recusada com 400.

## 10. Proibições explícitas (anti-slop)

Violação de qualquer item é motivo para rejeitar a mudança:

1. **Nenhuma biblioteca nova** (gráfico, CSS, utilitário) sem justificativa
   escrita neste documento. Recharts é a única biblioteca de gráficos do módulo.
2. **Nenhuma cor fora da paleta da seção 4.1.** Em especial: nada de azul/roxo/
   vermelho "SaaS", nada de `text-primary`/`bg-primary` do tema em elementos de
   destaque.
3. **Nenhum arredondamento ou sombra** nos painéis (`rounded-none`,
   `shadow-none`); nenhum `border-radius` novo em cards do módulo.
4. **Nenhuma moda de UI**: gradientes, glassmorphism, blur, animações de
   entrada, skeletons com shimmer, micro-interações que atrasam leitura.
5. **Nenhum emoji**, nenhum texto em inglês na interface, nenhum texto genérico
   de estado vazio ("Algo deu errado", "Em breve", "Aqui você encontra…").
6. **Nenhum `div` cru no lugar de componente de UI existente**
   (`components/ui/*`); nenhum estilo ad hoc quando há token ou receita na
   seção 4.
7. **Nenhuma duplicação de lógica** de agregação, de normalização ou de
   formatação de moeda dentro de componente.
8. **Nenhuma chamada a portal externo no cliente**; nenhum dado pessoal
   persistido (a regra da folha vale para qualquer integração futura).
9. **Nenhuma mudança silenciosa de base de cálculo** (taxa de execução,
   comprometido, pessoal, emendas) — toda mudança de fórmula exige atualizar a
   seção 6 **e** os textos que explicam o cálculo na interface (tooltips,
   descrições).
10. **Nenhum "placeholder" de feature** ("em breve", "futuramente", UI
    desabilitada sem rota).
11. **Nenhuma reescrita cosmética em massa**: reformatar, renomear ou
    reestruturar indiscriminadamente quebra histórico e diff. Mudança de nome ou
    estrutura só com propósito funcional e registro aqui.
12. **Nenhuma alteração no schema do banco para este módulo** — ele é somente
    leitura (R12). Os modelos `FiscalYear`, `ExerciseOrganization`,
    `ExerciseUnit` e `ExerciseUnitExecutor`, criados para os múltiplos
    exercícios, pertencem à importação e à curadoria; este módulo apenas lê o que
    elas alimentam.
13. **Nenhuma tabela nova ad-hoc com markup próprio** onde `ExecutionTablePanel`
    serve (com `moneyColumns`/`hideRate`).
14. **Nenhum gráfico novo fora do padrão da seção 7.7**: sem pizza em visões de
    execução (a pizza existe só na folha), sem `layout="horizontal"` fora do
    `CycleStackedBarChart`/`ExecutionChartCard`, sem eixo categórico com mais de
    100 itens. Os tipos novos (empilhado do ciclo, linha do ciclo, dispersão)
    são permitidos apenas na forma registrada na seção 7.7 — nunca uma variação
    livre (ex.: área empilhada, pizza, radar) fora dela.
15. **Nenhum "ajuste" de UI que ande na contramão das decisões da seção 9** —
    inclusive "melhorar o visual" dos painéis verdes/pretos, que é a identidade.
16. **Nenhuma opção fora do contrato oferecida ao usuário.** Ao propor
    alternativas (cor, efeito, layout), *todas* as opções apresentadas já devem
    respeitar as seções 4 e 10. Aprovação do usuário **não** valida uma opção
    proibida: quem revoga uma regra é uma edição deste documento, não um clique.
    Esta regra existe porque já falhou — uma sessão ofereceu âmbar e degradês
    como escolhas legítimas, violando 10.2 e 10.4, e coube ao usuário recusar
    quatro vezes o que o contrato já proibia.
17. **Nenhuma mudança declarada pronta sem a verificação da seção 11.** Quando um
    item do checklist não puder ser cumprido — por exemplo, sem navegador para
    conferir as três larguras (item 2), o re-render das abas ocultas (item 4) ou
    o print em `xl` (item 11) —, diga **quais** itens ficaram por verificar em vez
    de omitir. "Compila" e "`tsc` limpo" não são "verificado".

## 11. Checklist antes de encerrar uma mudança

1. `npm run lint` na raiz passa (`tsc --noEmit` sem erros novos).
2. Testado em **três larguras**: ≥ `2xl` (KPIs 6 colunas), `xl`–`2xl` (trilha
   lateral, colapso), < `sm` (1 coluna, trilha em faixa).
3. Navegação por setas ← → funciona e **ignora** inputs, selects, comboboxes e
   abas internas por tema (o guard do handler deve continuar intacto).
4. Abas não piscam ao alternar (`forceMount` mantido); `React DevTools` (ou
   profiler) não mostra re-render das abas ocultas em troca de métrica/filtro
   (`memo` mantido).
5. Filtros em cascata: órgão limpa unidade+fonte; unidade limpa fonte; "Limpar
   filtros" desabilita quando limpo; opções de unidade/fonte refletem o recorte.
   **Trocar o exercício limpa órgão+unidade+fonte+função+subfunção+busca**, e as
   opções passam a refletir apenas o QDD do ano escolhido.
6. Somatórios conferem: para o QDD vigente, a soma dos buckets de cada
   agregação fecha com o total geral (nada descartado, nada duplicado) — e isso
   vale **em cada exercício**, não só no corrente.
7. Textos novos seguem o padrão: pt-BR, `uppercase tracking` em rótulos,
   `tabular-nums` em números, `formatMoney`/`compactMoney` em valores.
8. Estado vazio e `Skeleton` cobertos para o que foi alterado; estados vazios
   com texto concreto.
9. Se a mudança tocou base de cálculo, catálogo manual, paleta ou componente de
   UI: seções 4/6/9/12 deste documento atualizadas.
10. Se a mudança mexeu na coleta da folha: `payroll-portal.ts` **e**
    `collect-payroll.mjs` alterados juntos; job manual disparado uma vez contra
    o mês vigente e resultado conferido no painel.
11. Print da mudança em largura `xl` conferido contra a receita visual da
    seção 4 (nenhuma cor/raio/sombra fora do contrato).

## 12. Catálogos e mapas manuais (manutenção)

Mudança no QDD ou no portal pode exigir tocar um destes — e **apenas** um
destes, nunca lógica nova de adivinhação:

| O que | Onde | Quando atualizar |
|---|---|---|
| Escopos da folha centralizada (código de ação → órgão/unidade) | `CENTRAL_PAYROLL_SCOPES` (`execution-monitor.ts:49-99`) | código novo/alterado de ação de folha no QDD |
| Órgãos do portal por escopo QDD | `PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE` (`payroll-scope.ts:37-103`) | órgão novo no portal, unidade nova no QDD, mudança de nome |
| Fontes vinculadas por órgão (comprometido) | `EARMARKED_SOURCES_BY_ORGANIZATION` (`fiscal-secretariat-view.tsx:54-61`) | novo órgão dominado por fontes vinculadas |
| Catálogo de fontes **por exercício** (SEPLAN/DIRPLA/DEPOP) | `CATALOGOS_POR_EXERCICIO` (`src/lib/fontes-recursos.ts`) | exercício novo exige registro explícito. Quando o anexo não muda de um ano para o outro, os dois anos apontam para o mesmo objeto — é o caso de 2025 e 2026. `getFonteLabel(code, year)` exige o ano e **não** cai no catálogo de outro exercício por conta própria: rótulo errado é pior que ausente. Ano não registrado mostra "Fonte não catalogada" |
| Catálogos da natureza (STN/SOF) | `src/lib/expense-nature.ts` | atualização da tabela oficial |
| Códigos de controle da dívida | `AMENDMENT_DEBT_CONTROL_CODES` (`functional-classification.ts:240-243`) | novos códigos de dívida iniciados em 8 |
| Siglas de órgão | `ACRONYM_OVERRIDES` (`organization-acronym.ts:10-23`) | órgão sem sigla extraível do nome |
| Renomeações de família de carreira | ramo `else` de `careerFamilyLabel` (`payroll-panel.tsx`) | denominação nova do portal que precisa de nome legível no ranking |

## 13. Limitações conhecidas (contexto, não tarefas)

Estas são limitações reais do dado de origem, já acomodadas no design. Não são
bugs a corrigir de afogadilho; qualquer tentativa de resolvê-las passa por
atualizar este documento.

- Emendas do tesouro estadual não têm tipo identificável no QDD
  (`NAO_IDENTIFICADO`).
- O endpoint do portal não é contrato público; a coleta é defensiva e isolada
  (o painel lê do banco, nunca do portal em tempo real), mas uma mudança no
  portal pode quebrar o job até ser detectada.
- Valores monetários em `Float` no schema — risco de arredondamento em somas
  muito grandes; as telas formatam em reais sem casas decimais na exibição
  compacta.
- `listActions` não filtra por fonte no banco; a carga do QDD vigente inteiro
  (com `expenseLines`) trafega para o navegador a cada `load()`.
- O portal publica a folha com atraso; o painel mostra o mês mais recente
  disponível, que pode não ser o corrente.
- O `payroll` carregado em paralelo com `catch` pode ficar `null` sem aviso ao
  usuário na primeira carga (a aba de folha mostra o vazio próprio).
- A dedução de tipo de emenda depende do texto do rótulo da fonte ("emenda" +
  palavra-chave); mudança de nomenclatura no catálogo pode rebaixar tipos para
  `NAO_IDENTIFICADO`.
- `CENTRAL_PAYROLL_SCOPES` (`execution-monitor.ts`) e
  `PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE` (`payroll-scope.ts`) continuam **sem
  dimensão de exercício**: são chaveados por código de ação e nome de órgão. Num
  exercício cujo QDD renumere as ações de folha, o escopo de pessoal vem vazio —
  o painel mostra estado vazio, nunca zero silencioso.
- Um exercício não registrado em `CATALOGOS_POR_EXERCICIO` mostra todas as suas
  fontes como "Fonte não catalogada" (seção 12). É o comportamento honesto, mas
  degrada a aba "Fonte de recurso" até o ano ser registrado. 2025 e 2026 já estão.

## 14. Referência rápida

| Arquivo | Papel |
|---|---|
| `src/app/orcamento/page.tsx` | página, layout, filtros, navegação, KPIs |
| `src/lib/use-exercise.ts` | exercício selecionado (URL `?exercicio=`) |
| `src/components/domain/exercise-select.tsx` | seletor de exercício do cabeçalho |
| `src/lib/execution-monitor.ts` | agregações, taxas, pessoal, folha centralizada, emendas |
| `src/lib/expense-nature.ts` | parser + catálogos da natureza |
| `src/lib/fontes-recursos.ts` | catálogo de fontes + derivação de grupo 2/3 |
| `src/lib/functional-classification.ts` | emenda, filtros funcionais |
| `src/lib/expense-breakdown.ts` | limpeza de descrição, linhas por conta+fonte |
| `src/lib/organization-acronym.ts` | siglas |
| `src/components/domain/execution-breakdown-panel.tsx` | `ExecutionChartCard`, `ExecutionTablePanel` |
| `src/components/domain/fiscal-secretariat-view.tsx` | visão por órgão |
| `src/components/domain/payroll-panel.tsx` | painel da folha |
| `src/components/domain/overview-scheduled-actions-panel.tsx` | aba Ações (variant execution) |
| `src/lib/payroll-scope.ts` | escopo QDD × portal, vínculos |
| `src/lib/payroll-portal.ts` | coleta server-only |
| `scripts/collect-payroll.mjs` | coleta standalone (CI) |
| `.github/workflows/folha.yml` | agendamento da coleta |
| `src/app/api/payroll/route.ts` | leitura da folha (agregados) |
| `src/app/api/budget-actions/route.ts` + `src/lib/store.ts:129` | carga das ações do QDD vigente |

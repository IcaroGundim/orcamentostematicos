# Design — Monitoramento da Execução Orçamentária (`/orcamento`)

Documento de **contrato** do módulo de execução orçamentária do painel da SEPLAN.
Seu objetivo é **preservar a estrutura de frontend que está posta** e impedir que
mudanças — em especial mudanças feitas por modelos de IA — introduzam elementos
estranhos ao sistema.

O **contrato visual** (paleta fechada, cantos retos, sem sombras, receitas de
componente) foi **retirado em 2026-10-14** por decisão do dono do produto — ver
a seção 4. O documento segue valendo para arquitetura, dados, cálculos e folha.

Todo conteúdo é descrito a partir do código atual. Referências relativas a
`apps/web/`. Quando este documento e o código divergirem, o código vence; a
divergência deve ser corrigida aqui, não no código.

---

## 1. Propósito e uso do documento

Escopo de aplicação (qualquer edição nestes caminhos deve respeitar os contratos
deste documento):

- `src/app/orcamento/page.tsx` — a página inteira;
- `src/components/domain/execution-breakdown-panel.tsx` (gráficos da aba
  `Gráficos`; `ExecutionTablePanel` sem uso desde 2026-10-01, seção 9, item 26),
  `src/components/domain/fiscal-secretariat-view.tsx`,
  `src/components/domain/payroll-panel.tsx`,
  `src/components/domain/overview-scheduled-actions-panel.tsx`,
  `src/components/domain/execution-visuals.tsx` (régua de indicadores, blocos e
  gráficos desenhados em SVG, desde 2026-10-14) — componentes do módulo;
- `src/lib/execution-monitor.ts`, `src/lib/payroll-scope.ts`,
  `src/lib/payroll-portal.ts`, `src/lib/expense-nature.ts`,
  `src/lib/fontes-recursos.ts`, `src/lib/expense-breakdown.ts`,
  `src/lib/organization-acronym.ts`, `src/lib/chart-palette.ts`,
  `src/lib/chart-geometry.ts`, `src/lib/readable-name.ts`, `src/lib/revenue.ts`,
  `src/lib/duodecimo.ts` — lógica;
- `scripts/collect-payroll.mjs` e `.github/workflows/folha.yml` — coleta da folha;
- `prisma/schema.prisma` — apenas se a seção 2 (regra R12) for seguida.

Regras de uso:

1. As seções 2 a 6 são **invariantes**. Violá-las exige reescrever a seção
   correspondente **antes** da mudança.
2. A seção 9 lista decisões deliberadas que parecem bugs. Não "corrigir" nenhuma
   sem atualizar este documento.
3. A seção 10 é a lista de proibições (arquitetura, dados, cálculos e texto da
   interface). Violar qualquer item é motivo para rejeitar a mudança.
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
   deixar de carregar. Do mesmo jeito busca `/revenue` (aba `Receitas`, seção
   6.8): **todos** os anos coletados de uma vez, porque a aba tem seletor de ano
   próprio e trocar o ano não pode disparar requisição; o `catch` vira mensagem na
   própria aba. Nenhuma rota nova pode ser consultada a cada interação;
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
   alternar — ver `src/components/ui/tabs.tsx:226-243`). `PayrollPanel`,
   `OverviewScheduledActionsPanel`, `OverviewActionRow`
   (`overview-scheduled-actions-panel.tsx:98`), `FiscalSecretariatView` e os
   componentes de `execution-visuals.tsx` (`KpiStrip`, `VizBlock` e os gráficos)
   são `memo`. Sem `memo`, cada
   mudança de estado da página (troca de aba, de métrica ou de filtro)
   re-renderizaria os painéis de **todas** as abas, inclusive as ocultas — e a
   tabela de ações chega a milhares de linhas.
5. **R5 — Navegação em dois níveis, preservada.** Visualização
   (`Ações`/`Gráficos`/`Órgão`/`Folha de pagamento`/`Receitas`, abas da faixa de navegação
   — seção 3.2; `Ações` é a primeira e a principal — estado inicial da página) ×
   Recorte (`Geral`/`Emendas parlamentares`, `VIEWS`, na mesma faixa, à direita).
   Até 2026-10-14 o recorte ficava na trilha lateral, como "Dimensão de
   análise"; subiu para a faixa quando a trilha saiu (seção 9, item 27). A aba
   `Tabela` (`table`) foi retirada em 2026-10-01; `Gráficos` (`overview`) saiu
   na mesma data e voltou em 2026-10-14 (seção 9, item 26).
   Selecionar um recorte **navega para lugar nenhum** — só troca o recorte, que
   se aplica às abas `Ações` e `Gráficos` **e à tela como um todo**: com
   `Emendas parlamentares` ativa, a régua de indicadores, o título e a contagem
   da seção de ações, o botão Exportar (`dimensionActions`), a tabela e a grade
   de gráficos refletem apenas as ações de emenda. Nova visualização = novo item
   em `CONTENT_VIEWS`, com entrada na faixa e no comportamento de setas — o
   `aria-label` do `Tabs` é derivado da mesma lista; novo recorte = novo item
   em `VIEWS`, refletido em `dimensionActions`.
6. **R6 — A página rola inteira; a faixa de navegação fica.** Desde 2026-10-14
   não há zoom (`PAGE_ZOOM` saiu; seção 9, item 1) nem rolagem confinada ao
   `<main>`: a raiz é `orcamento-page-root min-h-svh`, o documento rola, o
   cabeçalho do app rola junto e a faixa de navegação é `sticky top-0`. A única
   rolagem interna obrigatória é a da tabela de ações: ela é virtualizada
   (`useVirtualizer` com `getScrollElement` no contêiner da tabela), então o
   contêiner tem altura própria (`h-[max(28rem,calc(100svh-9rem))]`). Trocar
   isso por rolagem da janela exige trocar o virtualizador junto.
7. **R7 — Filtros numa linha, sem trilha lateral.** Os filtros do QDD ocupam a
   linha `orcamento-filters` sob a régua de indicadores (seção 3.3). A trilha lateral com
   colapso (`xl:w-64`/`xl:w-16`) saiu em 2026-10-14, e com ela o seletor
   "Exibir valores de": a tabela mostra sempre todos os estágios (seção 7.3) e
   os gráficos não dependem de um estágio escolhido.
   A linha de filtros e a régua de indicadores **somem** nas visões executivas
   (`Órgão`, `Folha de pagamento` e `Receitas`, `isExecutiveView`), que ou não
   usam os filtros do QDD (folha, receitas) ou têm os próprios controles (órgão).
8. **R8 — Filtros em cascata.** Órgão → Unidade → Fonte. Trocar órgão limpa
   unidade e fonte; trocar unidade limpa fonte (`page.tsx:718-737`). As opções de
   unidade e fonte são derivadas das ações já filtradas pelo nível anterior
   (nunca apontam para recortes vazios). O botão "Limpar filtros" está sempre
   presente e desabilitado quando `!hasFilters` — a linha não muda de forma ao
   filtrar.
9. **R9 — Integrações externas seguem o padrão da folha.** Fonte externa
   (portal, API pública) = coleta em job server-side (`scripts/` + workflow
   GitHub), persistência **somente de agregados**, leitura por rota `/api/*`
   protegida por sessão. Proibido buscar em portal externo a partir do cliente,
   proibido persistir dado pessoal identificável.
   As receitas (aba `Receitas`, desde 2026-10-15) seguem esse padrão com uma
   diferença: o job é **semanal** (`.github/workflows/receitas.yml`) e o script
   importa a classificação de `src/lib/revenue.ts` direto, em vez de manter uma
   cópia como a folha (seção 8).
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
    `PayrollSnapshot`/`PayrollGroup` exige reescrever as seções 6.6 e 8; alterar
    `RevenueMonth` (criada em 2026-10-15 pelo push protegido, para as receitas),
    as seções 6.8 e 8.

## 3. Anatomia da tela

Redesenhada em 2026-10-14 a partir do mockup aprovado pelo dono do produto
(`mockups/orcamento-redesenho-v7.html`; seção 9, item 27). Estrutura (`page.tsx`):

```
orcamento-page-root (min-h-svh; a página rola inteira)
├─ header.orcamento-app-header (h-14, bg-marca) — rola junto com a página
├─ nav.orcamento-view-bar (sticky top-0 z-30) — abas · recorte; sempre visível
└─ main.orcamento-main
   ├─ orcamento-global-kpis (régua de indicadores) — oculta nas visões executivas
   ├─ orcamento-filters (linha de filtros; em Ações, com Exportar à direita)
   │  — oculta nas visões executivas
   └─ Tabs das visualizações (Ações, Gráficos, Órgão, Folha de pagamento, Receitas)
```

Margem lateral única para tudo: `px-6`, `xl:px-10`.

### 3.1 Cabeçalho do app

`orcamento-app-header flex h-14 items-center gap-5 bg-marca text-marca-contraste`.
Da esquerda para a direita:

- logo `/logo.svg` (`h-7 w-auto`);
- título `Execução orçamentária` (`text-base font-semibold`, caixa normal);
- **← Orçamentos Temáticos**: botão-link (`ArrowLeftIcon`, texto
  `text-marca-contraste/80`, rótulo `hidden md:inline`) que faz
  `router.push('/seplan')`. Até 2026-10-14 era o botão verde "Voltar a
  Orçamentos Temáticos" no heading; mudou para o cabeçalho porque o heading
  saiu, e o cabeçalho existe em todas as abas;
- à direita (`ml-auto`):
  - **seletor de exercício** (`ExerciseSelect`,
    `src/components/domain/exercise-select.tsx`), sem mudança: `Select` claro
    com `CalendarRangeIcon`, **visível mesmo com um só exercício**
    (desabilitado nesse caso) — quem opera precisa enxergar em que exercício
    está. Exercícios comparativos ganham o sufixo `Comparativo`, e o corrente,
    `Corrente`. O estado vive na URL (`?exercicio=2026`) via `useExercise`
    (`src/lib/use-exercise.ts`), e trocar o exercício **limpa órgão, unidade,
    fonte, função, subfunção e busca**, porque a estrutura do QDD difere entre
    anos;
  - **Atualizar** (`variant="ghost"`, texto claro) → re-executa `load()`;
    `RefreshCwIcon` com `animate-spin` enquanto `isLoading`; rótulo
    `hidden lg:inline`;
  - **Sair** (`variant="ghost"`) → `clearStoredSession()` +
    `router.push('/login')`, com trava `isSigningOut`.

### 3.2 Faixa de navegação

`<nav aria-label="Navegação entre visualizações">` com `orcamento-view-bar
sticky top-0 z-30 flex items-end gap-8 border-b bg-white`. Fica fora do `<main>`
e é a única navegação nas visões executivas — não condicioná-la a
`isExecutiveView`.

- **Abas** (`role="tablist"`, `aria-label="Visualizações da execução"`): um
  botão por item de `CONTENT_VIEWS` (`role="tab"`, `aria-selected`), texto
  `text-[15px]`. Inativa: `font-medium` cinza (`#80857f`), escurece no hover com
  um filete claro embaixo. Ativa (reforçada em 2026-10-15, pedido do dono do
  produto): `font-bold` no verde-escuro da marca (`text-marca-escura`) com
  sublinhado de 4px no verde da marca (`border-b-4 border-marca`; `pb-[13px]`
  mantém a altura). Cada rótulo reserva a largura da versão em negrito (cópia
  invisível no mesmo `grid`), para a troca de aba não empurrar as vizinhas. Sem ícone e sem a pílula deslizante de `useHoverPill` desde
  2026-10-14 (seção 3.7). Externo com `overflow-x-auto overflow-y-hidden` e
  barra de rolagem oculta para telas estreitas; o `-mb-px` que leva o
  sublinhado sobre a borda da faixa fica nesse contêiner, não nos botões
  (nos botões ele vazava 1px e criava rolagem vertical nas abas).
- **Recorte** (à direita, `ml-auto`): rótulo `Recorte` e um botão por item de
  `VIEWS` (`Geral`, `Emendas parlamentares`), `aria-pressed`, o ativo em
  negrito com sublinhado escuro de 2px. Fica `invisible` (e não some) nas
  visões executivas: a faixa não muda de altura nem as abas mudam de lugar ao
  trocar de aba.

Saíram em 2026-10-14 o contador `{n} de {total}` e os botões Anterior/Próximo:
a faixa passou a ficar sempre visível no topo, e as setas ← → do teclado
continuam navegando (seção 11, item 3).

### 3.3 Linha de filtros

`orcamento-filters flex flex-wrap items-center gap-2.5 border-b py-3.5`, logo
abaixo da régua de indicadores, **só** em `Ações` e `Gráficos`. Até 2026-10-15
ficava acima da régua; desceu quando a aba Ações perdeu o cabeçalho próprio
(seção 3.5), para os filtros ficarem colados à tabela que filtram. Na aba
`Ações`, a linha termina com **Exportar** (seção 3.5), depois do resumo
"Nenhum filtro aplicado". O resumo é `min-w-0 flex-1 basis-0 truncate
text-right`: ocupa só a sobra entre Limpar e o botão e corta com reticências
(texto inteiro no `title`), e o botão é `shrink-0`. Sem isso, um nome de órgão
longo no resumo jogava o botão para uma segunda linha. Os campos não têm rótulo
visível: o próprio valor diz o filtro (`Órgão: todos`, `Unidade: todas`,
`Fonte: todas`; escolhido, o rótulo da opção já diz o código e o nome). A
busca tem `aria-label`.

- **Buscar** (`w-60`): `Input` com `SearchIcon` à esquerda (`pl-8`),
  placeholder "Buscar ação, programa…". Normalização `normalize()` (sem
  acentos, minúsculas) sobre `application`, `projectActivity`,
  `functionalProgram`, `organizationName`.
- **Órgão**, **Unidade**, **Fonte** (`SearchableCombobox`, `w-40`):
  opções e cascata da regra R8. Unidade: chave `{org}|{unit}`, rótulo com
  `org/unit — nome` sem órgão filtrado e `unit — nome` com. Fonte: código
  normalizado por `normalizeSourceCode` e rótulo
  `{código} — {getFonteLabel ?? "Fonte não catalogada"}`.
- **Função/Subfunção**: `FunctionalClassificationFilters` com
  `showLabels={false}`.
- **Limpar** (`variant="ghost"`), sempre presente e desabilitado quando
  `!hasFilters`.
- **Estado do recorte** (`ml-auto`, `text-sm text-muted-foreground`):
  "Nenhum filtro aplicado" ou o nome do recorte (`headingTitle`: a unidade
  escolhida, senão o órgão, senão "Filtros aplicados").

### 3.4 Régua de indicadores (`KpiStrip`)

`orcamento-global-kpis`, faixa de fundo `bg-[#f5f6f2]` com `border-b`, só em
`Ações` e `Gráficos`; a visão `Órgão` usa a mesma régua com os totais do órgão.
Seis células, valores **por extenso** (`formatMoney`, nunca compactos):

**Na aba `Ações`, a régua é vertical** (em teste desde 2026-10-16, pedido do dono
do produto):
- **Layout:** a partir de `2xl` (1536px), os seis indicadores ficam numa coluna
  de 15,5rem à esquerda (`KpiStrip orientation="vertical"`), fixa ao rolar
  (`sticky top-[58px]`, sob a faixa de navegação). À direita ficam a linha de
  filtros e a tabela, que sobem para o topo.
- **Telas menores:** abaixo de 1536px a coluna tiraria espaço da tabela e
  esconderia Pago e Execução atrás da rolagem horizontal, então volta a régua
  horizontal sobre filtros e tabela.
- **Filtros:** são uma variável (`filterRow`) montada num lugar só por vez — sob
  a régua em Gráficos e na coluna da direita em Ações.
- **Tabela:** a largura mínima caiu de 82rem para 76rem para caber ao lado da
  coluna.

A régua horizontal (abaixo) segue valendo em Gráficos e nas telas estreitas de
Ações.

1. **Execução** (célula principal): anel de 70px com liquidado ÷ dotação
   atualizada, o percentual em `text-[40px]` e a linha "liquidado ÷ dotação";
   em Emendas, o rótulo vira "Execução · emendas".
2. **Dotação inicial** — "lei orçamentária".
3. **Dotação atualizada** — "+R$ … em créditos" (atualizada − inicial, com
   sinal; seção 6.7).
4. **Empenhado** — anel pequeno + "% da dotação".
5. **Liquidado** — anel pequeno + "% da dotação".
6. **Pago** — anel pequeno + "% do liquidado" (base do pagamento, seção 6.5).

Colunas e filetes em `.orcamento-kpis` (`globals.css`), e não em classes do
Tailwind: o Tailwind ordenava `min-[1360px]:` antes de `sm:` e a régua nunca
passava de três colunas. Duas colunas abaixo de `sm` (com a execução ocupando a
linha inteira), três até 1360px e `1fr 1fr 1.2fr 1fr 1fr 1fr` a partir daí, com
filete vertical entre as células. Abaixo de 1360px (inclusive em 1280px) os
valores por extenso não cabem em seis colunas e a régua passa a 3 × 2. `Skeleton`
nos valores durante o carregamento. Cores dos anéis: `STAGE_COLORS`.

### 3.5 Conteúdo por aba

- `actions` — tabela de ações (seção 7.3), **sem cabeçalho próprio** desde
  2026-10-15 (pedido do dono do produto): saíram o `h2` "Ações orçamentárias" e
  a contagem "{N} ações, na ordem do QDD", e a linha de filtros ocupa o lugar;
  - na linha de filtros, à direita: **Exportar**. O botão "Mostrar todos os
    estágios / só o essencial" saiu em 2026-10-15 (pedido do dono do produto):
    a tabela mostra sempre todos os estágios da despesa;
  - **Exportar** (`Popover` com `Select` de formato Excel/CSV/JSON + botão
    "Exportar recorte filtrado"): exporta **client-side** o recorte do recorte
    ativo (`dimensionActions`: `filteredActions` em Geral; só as ações de
    emenda em Emendas parlamentares — seção 5.3), com import dinâmico de
    `src/lib/execution-export.ts` (o `xlsx` não entra no bundle principal). No
    Excel, sheet única estruturada por órgão: cabeçalho geral e, na sequência,
    uma linha de seção mesclada por órgão (`{código} — {nome} (N ação(ões))`,
    ordem de código) com as ações dele abaixo; valores monetários e percentual
    como números formatados (`#,##0.00` / `0.0`). A edição community do SheetJS
    não aplica fonte/fundo — a hierarquia vem das seções mescladas. O arquivo
    **nunca contém dado da folha de pagamento**; nome
    `execucao-orcamentaria-{ano}-{data}.{ext}` com `loadedYear ?? year`. Sem
    recorte, o botão desabilita e um `toast.error` concreto explica. Até
    2026-10-14 o Exportar ficava no heading da página e valia também para a aba
    Gráficos; o heading saiu e o botão foi para a seção de ações, que é o que
    ele exporta;
  - a tabela (`OverviewScheduledActionsPanel` com `variant="execution"`).
- `overview` (`Gráficos`): `Tabs` interno pelo recorte (`value={view}`), um
  `TabsContent` `forceMount` por recorte, cada um com a grade `gridClass`
  (`grid grid-cols-1 gap-x-10 gap-y-8 min-[1180px]:grid-cols-2`). Quatro blocos
  (`VizBlock`, seção 7.7), nesta ordem:
  - `geral`: **Para onde vai a despesa** (mapa de áreas dos 10 maiores
    elementos, área = dotação, cor = % executado na rampa sequencial) · **De onde
    vem o recurso** (rosca das 5 maiores fontes + "Demais fontes") · **Quem tem
    orçamento grande e execução baixa** (dispersão dos órgãos) · **Como a
    dotação mudou desde a lei** (halteres de todos os órgãos com alteração,
    do maior saldo absoluto para o menor; as linhas rolam dentro de um teto de
    296px e o eixo fica fixo embaixo, desde 2026-10-15; ocupa a largura toda
    do card, medida por `ResizeObserver`, em escala 1:1 — sem o teto de 720px
    dos demais SVGs);
  - `amendments`: **Quem recebe as emendas** (mapa de áreas dos 12 maiores
    órgãos, cor categórica) · **Maiores emendas** (pirulito das 6 maiores ações)
    · **Onde o dinheiro das emendas é aplicado** (rosca dos 5 maiores elementos
    + "Demais elementos") · **Como a dotação mudou desde a lei** (halteres, sobre
    as emendas).
  Cada bloco tem uma frase de leitura calculada do próprio dado (ex.: "Saldo de
  +R$ 460,1 mi: R$ 2,3 bi em acréscimos e R$ 1,8 bi em reduções"). Trocar um
  bloco é decisão de layout desta seção.
- `fiscal`: `FiscalSecretariatView` (seção 7.4).
- `payroll`: `PayrollPanel` (seção 7.5) ou `Skeleton h-96 w-full`.
- `revenue` (`Receitas`): `RevenuePanel` (seção 7.8) — seletor **Ano das
  receitas** (2016 até o corrente), régua própria da receita, **Arrecadação mês
  a mês** (colunas empilhadas por grupo) e **Receita por tributo** (tabela
  tributo × mês). O ano começa no exercício do cabeçalho; depois de escolhido na
  aba, fica.

### 3.6 Estados da página

- **Sem sessão**: `router.push('/login')` no primeiro `useEffect`.
- **Perfil não-admin**: `router.push('/secretaria')`.
- **Carregando** (`isLoading`): `Skeleton` nos valores da régua, `Skeleton h-96`
  no corpo das abas, Atualizar com ícone girando.
- **Vazio**: cada componente tem estado vazio próprio (seção 7), com texto
  concreto em pt-BR.
- **Erro de carga**: `toast.error` com a mensagem da API (o helper `api()` de
  `src/lib/api.ts` lança o `message` do JSON de erro, ou o texto bruto; 401
  limpa a sessão e vai para `/login`).

### 3.7 Responsividade

| Largura | Comportamento |
|---|---|
| `< sm` | régua 2 colunas; filtros quebram linha; abas rolam na horizontal |
| `sm`–1360px | régua 3 × 2 |
| < 1180px | grades de Gráficos e Órgão em uma coluna |
| ≥ 1180px | grades em duas colunas |
| ≥ 1360px | régua em 6 colunas |

Sem zoom desde 2026-10-14 (seção 9, item 1).

`useHoverPill` (`src/components/ui/tabs.tsx`) segue em uso nos orçamentos
temáticos, mas **não** mais em `/orcamento`: a faixa de navegação usa sublinhado
fixo, e a trilha lateral, onde ficava a outra pílula, saiu. As notas sobre a
pílula (ref de callback, `pill.ready` antes de clarear o texto) continuam valendo
para quem a usa.

## 4. Visual (contrato retirado em 2026-10-14)

O contrato visual — paleta fechada, cantos retos, ausência de sombras e as receitas
de componente — foi **retirado em 2026-10-14** por decisão do dono do produto. O
visual do módulo deixa de ser regra: onde as seções 3 e 7 citam classes e cores,
elas descrevem o código atual, não um padrão obrigatório. Ficam só informações
úteis para quem mexer:

- **Cromo** (cabeçalho do app, sublinhado da aba ativa, cabeçalho da tabela de
  ações e faixas de título dos blocos): segue o verde da marca, que mora em quatro tokens de `globals.css`
  (`--marca`, `--marca-hover`, `--marca-escura`, `--marca-contraste`) gerados por
  `derivarPaleta()` (`src/lib/paleta-marca.ts`, com testes). Para trocar a cor:
  `npm run build:lab`, conferir no painel "Cores" e colar o bloco gerado. Sobre
  uma superfície da marca, `text-marca-contraste` (e não `text-white`) acompanha o
  contraste se a marca clarear. O login mantém o verde anterior pela classe
  `.marca-anterior`, aplicada também ao diálogo de acesso rápido (portal).
- **Gráficos**: as cores de dado moram em `src/lib/chart-palette.ts`, separadas da
  marca, e foram validadas para daltonismo (protanopia/deuteranopia):
  - `STAGE_COLORS` — uma cor por estágio do ciclo da despesa, igual em todo o
    módulo: dotação violeta, empenhado laranja, liquidado azul, pago verde. Vale
    para os anéis da régua e da tabela, a dispersão, a folha da visão `Órgão` e
    os pirulitos;
  - `CHART_CATEGORICAL` — oito tons em ordem fixa para listas e séries (barras de
    participação, pizza e listas da folha, curva do ciclo). Não cicla: o que passa
    de oito vira "Demais" (`CHART_OTHER`, cinza) ou uma cor só;
  - `CHANGE_COLORS` — acréscimos azul e reduções vermelho nos halteres da
    dotação (`CHANGE_TEXT_COLORS`, mais escuros, no texto do saldo);
  - `SEQUENTIAL_EXECUTION` — rampa de um azul só, em cinco faixas de 10 pontos,
    para "% executado" no mapa de áreas.
- **Campos retos**: os componentes compartilhados (`select`, `input`, `popover`,
  `searchable-combobox`) nascem arredondados por servirem a `/seplan` e
  `/secretaria`; o módulo os aplaina por CSS em `globals.css` —
  `.orcamento-main [data-slot=…]` para o que está dentro do `<main>` e
  `body:has(.orcamento-page-root) …` para os painéis portados para o `<body>`.
  Mudar isso é editar essas regras, não os componentes compartilhados.
- **Formatação de valores** (continua regra, seção 10.7): `formatMoney`
  (`src/lib/api.ts`) nas células e `compactMoney` (`mil`/`mi`/`bi`) em eixos e
  listas compactas; contagens com `toLocaleString('pt-BR')`; texto em pt-BR.
- **"Limpar filtros" vermelho com filtro ativo** foi pedido pelo dono do produto em
  2026-09-10 (`variant="destructive"`, alternando com `hasFilters`).

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
| Receitas | `GET /api/revenue` | `RevenueMonth` inteira (série desde 2016, ~2 mil linhas), gravada pelo job semanal (seção 8.1); restrita a `SEPLAN_ADMIN`; devolve `summaries`, um resumo de `summarizeRevenue` (seção 6.8) por ano, do mais recente ao mais antigo, cada um com `collectedAt` (última coleta do ano) e `partialMonth` (mês corrente, se já coletado). **Não** recebe `?year=`: o seletor de ano é da aba. Carregada em `load()` em paralelo, com `catch` próprio — a falha vira mensagem na aba, o resto do painel carrega |
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
não adicionar colunas com eles sem documentá-las aqui).

### 5.3 Estado da página e derivações

Todos os `useMemo` da página e o que os invalida:

| Derivação | Depende de | Propósito |
|---|---|---|
| `organizationOptions` | `organizations` | opções do combo de órgão |
| `fiscalOrganizationOptions` | `organizations` | opções da visão por órgão ("Selecione uma secretaria") |
| `unitOptions` | `actions`, `organizationCode` | unidades do órgão selecionado |
| `sourceOptions` | `actions`, `organizationCode`, `unitFilter` | fontes das ações do recorte órgão+unidade |
| `filteredActions` | 6 filtros + `actions` | recorte dos filtros, base de `amendments` e de `dimensionActions` |
| `totals` | `filteredActions` | régua de indicadores (Geral) e grade `geral` |
| `fiscalActions` | `actions`, `organizationCode`, `unitFilter` | recorte da visão por órgão (sem fonte/função/busca) |
| `selectedOrganization` | `organizations`, `organizationCode` | objeto do órgão na visão fiscal |
| `fiscalPayrollHeadcount` | `payroll`, `organizationCode`, `unitFilter` | vínculos da folha no escopo do órgão (seção 6.6) |
| `personnelScope` | `actions`, `fiscalActions`, `selectedOrganization`, `unitFilter` | ações locais vs. folha centralizada (3 casos, abaixo) |
| `amendments` | `filteredActions` | ações de emenda dentro dos filtros (recorte `emendas`) |
| `amendmentTotals` | `amendments` | régua no recorte de emendas e grade `amendments` |
| `headingTitle` | `actions`, `selectedOrganization`, `unitFilter` | nome do recorte na linha de filtros |
| `dimensionActions` | `view`, `amendments`, `filteredActions` | recorte dominante da tela: alimenta a contagem da seção de ações, Exportar e a tabela |
| `dimensionTotals` | `view`, `amendmentTotals`, `totals` | régua de indicadores (não é memo: só escolhe entre dois memos) |
| `hasFilters` | 6 filtros | habilita "Limpar" |

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
  Nas categorias por entrega (OSG Cat. 2, Climático Indireta) a contribuição
  temática vale o **executado informado nas entregas de validações aprovadas**
  (`deliveryExecutedValue`), não um percentual do orçamento — inclusive na
  exportação da visão geral (`overview-export.ts`), que o recebe pela prop
  `deliveryExecutedByAssignment` do painel. Sem o mapa, essas linhas saem
  zeradas — não é aceitável.
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
| `aggregateBudgetChangesByOrganization` | linha | código do órgão (como `aggregateByOrganization`); devolve `BudgetChangeRow` = `ExecutionRow` + `increases`/`reductions`/`netChange` (seção 6.7) |

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
- **Índices de execução** (régua de indicadores, seção 3.4): Empenho e
  Liquidação sobre a dotação atualizada; **Pagamento sobre o liquidado**
  (`paid ÷ liquidated`) — bases diferentes por definição de cada ato
  (comprometer ≠ executar ≠ pagar).
- **Folha de pagamento** (desde 2026-10-14; regra na seção 6.6):
  `payrollBudgetTotalsOf` aplicada a `localPersonnelScope` (ações do órgão
  **menos** as centralizadas) e a `centralPayrollActions`; totais somados;
  participação = `updatedBudget(folha) ÷ (updatedBudget(ações locais) +
  updatedBudget(folha centralizada))` — a mesma base de antes.
- **Sem nenhum valor liquidado**: ações não-emenda com `updatedBudget > 0` e
  liquidado zero, maiores dotações primeiro, top 5. Quando não há nenhuma (o QDD
  de setembro já tem pouca ação parada), o bloco vira **Menor execução** e lista
  as cinco menores taxas, com o percentual — um alerta prático, não um ranking
  estatístico.
- **Composição**: unidades (mapa de áreas; com uma unidade selecionada, o bloco
  passa a mostrar os elementos de despesa da unidade), fontes (grade de 100
  quadradinhos, 4 maiores + "Demais fontes") e categorias (rosca).
- **Apresentação**: "Apresentar" entra em fullscreen da visão
  (`requestFullscreen`/`exitFullscreen`); "Imprimir" chama `window.print()`. Os
  blocos marcam `fiscal-print-section`.

### 6.6 Folha de pagamento

**Gasto de folha da visão Órgão** (`payrollBudgetTotalsOf`, desde 2026-10-14):

- só as **ações de folha** (`isPayrollAction`: "folha de pagamento" na
  aplicação normalizada, sem acento nem caixa), do próprio órgão e da parte dele
  na folha centralizada da SEAD (abaixo);
- todas as linhas dessas ações **menos** os elementos **34** (outras despesas de
  pessoal decorrentes de terceirização) e **36** (serviços de terceiros — pessoa
  física). Linha com natureza ilegível entra: está numa ação de folha;
- o valor deixado de fora sai em `excludedUpdatedBudget` e aparece no bloco,
  para a exclusão ser visível.

Decisão do dono do produto em 2026-10-14: a tentativa de medir terceirizados se
mostrou imprecisa, e a visão passou a mostrar só a folha do Estado. Antes valia o
custo ampliado abaixo, que somava todo o GND 1 do órgão (inclusive fora das
ações de folha e o elemento 34) e o elemento 36 das ações de folha. A diferença é
real: na SEE, em maio/2026, a folha pela regra nova é R$ 1.546.462.110,19
(R$ 1.528.756.755,58 no órgão + R$ 17.705.354,61 da folha centralizada), com
R$ 300.000,00 de elementos 34/36 fora.

**Custo ampliado de pessoal** (`personnelTotalsOf`, sem uso na interface desde
2026-10-14; mantido porque é a definição documentada se o indicador voltar):

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

### 6.7 Créditos adicionais e reduções (`aggregateBudgetChangesByOrganization`)

- **O que o QDD entrega**: a coluna "Suplementado" já vem **líquida por linha** —
  `Dotação inicial + Suplementado = Ini+Sup+Cor-Red` em todas as linhas (6.240 de
  6.240 no QDD de maio/2026), e 802 delas são negativas. O arquivo não separa,
  dentro de uma linha, o crédito adicional da anulação que o financiou.
- **Cálculo**: a alteração de cada linha é `updatedBudget − initialBudget` (e não o
  campo `supplemented`, para fechar com os KPIs por construção, inclusive em dado
  antigo sem a coluna). Por órgão: `increases` = soma das linhas com alteração
  positiva; `reductions` = soma das negativas (valor negativo); `netChange` =
  `increases + reductions` = dotação atualizada − inicial do órgão.
- **Leitura honesta**: como cada linha já vem líquida, `increases` e `reductions`
  são **limites inferiores** dos fluxos brutos de crédito e de redução — um
  remanejamento dentro da mesma linha não aparece. O saldo (`netChange`) é exato.
  A descrição do cartão diz isso; não rotular `increases` como "total de créditos
  adicionais abertos".
- **Fechamento**: a soma de `netChange` de todos os órgãos é igual a
  `totalsOf(actions).updatedBudget − totalsOf(actions).initialBudget` (no QDD de
  maio/2026: R$ 460.102.247,97 = R$ 2.300.414.454,98 de acréscimos −
  R$ 1.840.312.207,01 de reduções). Órgão só com reduções aparece (barra só à
  esquerda do zero); órgão sem alteração nenhuma fica fora do gráfico.
- **Emendas**: no QDD de maio/2026 o saldo das ações de emenda é zero, mas a
  movimentação não: R$ 98,8 mi saem da reserva de emendas na SEPLAN (redução) e
  chegam aos órgãos que as executam (acréscimos). É isso que o cartão da grade de
  emendas mostra. Saldo que arredonda a zero é exibido como `R$ 0,00`, nunca
  `-R$ 0,00`.
- **Sem alteração no recorte** (ex.: filtro num órgão que não teve crédito nem
  redução): estado vazio próprio ("Nenhuma alteração de dotação no recorte…"),
  não o genérico de filtros.

### 6.8 Receitas (`src/lib/revenue.ts`)

Duas etapas puras: `bucketRevenue` (linhas do portal → um agregado por mês e
categoria, o que o job grava em `RevenueMonth`) e `summarizeRevenue` (agregados →
resumo da tela, o que a rota devolve). `aggregateRevenue` encadeia as duas.

Fonte: `/receitas/listar` do Portal da Transparência, **um mês por consulta**
(`periodo=3`, `mes`), com `orgao=0` e `filtro=0` — vazios derrubam a rota com
HTTP 500. Conferido em 2026-10-15: o `arrecadado` de cada linha é **do mês**,
não acumulado; `previsto` é a previsão anual da lei, repetida em todo mês;
`previstoatualizado` muda ao longo do ano.

- **Classificação** (`classifyRevenue(código, ano)`): natureza nos 8 primeiros
  dígitos; vence o primeiro prefixo de `REVENUE_NATURE_PREFIXES` que casar, na
  **estrutura em vigor no ano** (`revenueNatureEra`). A STN reorganizou os
  códigos duas vezes no período, e o mesmo código muda de sentido: `11130200` é
  ICMS em 2016 e IRRF hoje. Estruturas (conferidas nos dados em 2026-10-15):
  - `antiga`, até 2017: ICMS `111302`, IPVA `111205`, ITCMD `111207`, IRRF
    `111204`, FPE `172101`, FUNDEB `1724`, SUS `172133`, royalties `172122`;
    multas e juros (`191142`) e dívida ativa (`193115`) do ICMS ficavam fora do
    imposto e são trazidos para ele;
  - `transicao`, 2018–2021: ICMS `111802`, IPVA `1118012`, ITCMD `1118013`,
    IRRF `11130`, FPE `1718011`, FUNDEB `1758`, SUS `171803`, royalties `171802`;
  - `atual`, de 2022 (Portaria Conjunta STN/SOF 650/2019, `C.O.E.D.DD.D.T`):
    ICMS `111450`, IPVA `111251`, ITCMD `111252`, IRRF `11130`, FPE `171150`,
    FUNDEB `175`, SUS `1713`, royalties `1712`; o tipo (principal, multas,
    dívida ativa) cai no mesmo tributo.
  Os prefixos genéricos (taxas `112`, contribuições `12`, intra `7`/`8`…) são os
  mesmos nas três. Grupos: `tributaria`
  (ICMS, IPVA, ITCMD, IRRF, Taxas, Taxas administrativas do Tesouro, Outros
  tributos), `transferencias` (FPE, IPI-exportação, ICMS-desoneração, FUNDEB,
  SUS, royalties, outras correntes, capital) e `demais`.
- **Categorias da base do duodécimo** (2026-10-16, seção 6.9): só na estrutura
  `atual`, porque o duodécimo só é calculado de 2025 em diante.
  - `IPI_EXPORTACAO` (`171153`) e `LC87` (`171951`, ICMS-desoneração da LC
    87/1996) saíram de "Outras transferências correntes".
  - `TAXAS_TESOURO`: taxa (`112`) arrecadada na **fonte 15000100**. É a única
    regra que olha a fonte (`classifyRevenue(código, ano, fonte)`). Em 2026, só
    R$ 290 mil previstos (taxas da SEFAZ); as demais taxas (DETRAN, fundos do
    Judiciário e da segurança) têm destino vinculado e seguem em `TAXAS`.
  - Ano coletado antes da mudança mantém essas receitas nas categorias antigas
    até ser recoletado.
- **Deduções**: código com 9 no lugar do primeiro dígito (`91145011` ↔ ICMS
  `11145011`). Entram no tributo de origem com o sinal do portal (negativo).
  Por tributo e mês: `net = gross + deductions`. A tabela mostra o **líquido**;
  o bruto fica no detalhe da célula. O FUNDEB **recebido** (natureza `175…`)
  aparece em Transferências; a dedução para formá-lo, no tributo de origem.
- **Intraorçamentárias** (7… e 8…) ficam num item próprio, dentro do total —
  como no total anual do portal.
- **Grupos** (`groups`): subtotal líquido por mês, no ano e da previsão
  atualizada de cada grupo, calculado em `aggregateRevenue` — a linha de grupo da
  tabela e as colunas empilhadas só leem esses valores (R3).
- **Fechamento**: nenhuma linha é descartada (o último prefixo é vazio); uma
  categoria gravada que saiu do catálogo cai em "Outras receitas correntes".
  Conferido em 2026-10-15 ano a ano, 2016–2025, contra o total anual de
  `/receitas/valores`: igual ao centavo em todos (2016: R$ 5.529,66 mi; 2020:
  R$ 7.026,97 mi; 2024: R$ 11.867,23 mi). Com as três estruturas, a série por
  tributo não tem saltos na troca de estrutura (ICMS líquido: R$ 863 mi em 2016,
  1.201 em 2018, 1.522 em 2022, 1.887 em 2025) e nada cai em "Outros tributos".
- **Filtro do gráfico mensal** (`selectedGroupNet`): líquido mensal por grupo
  somando só as categorias marcadas; com todas marcadas, igual a `groups`.
- **Comparação com o ano anterior** (`compareSamePeriod`): líquido dos meses
  fechados do ano escolhido contra os mesmos meses do ano anterior; o mês em
  curso fica de fora, para não comparar mês parcial com mês inteiro. Conferido
  em 2026-10-15 contra o total anual de `/receitas/valores`: líquido 2026
  (jan–out) = R$ 11.036.517.915,93 e 2025 = R$ 13.412.211.059,34, iguais ao
  centavo. A previsão atualizada vem da **soma das linhas** do último mês: o
  campo `previstoatualizado` do total anual do portal sai quase o dobro da
  soma das linhas (R$ 24,85 bi contra R$ 13,94 bi em 2026) e não é usado.
- **Realizado** = líquido arrecadado ÷ previsão atualizada (líquida), via
  `shareOf`.
- **Mês em curso** (`partialMonth`): no exercício corrente, se a última coleta
  já pegou o mês corrente, ele ainda está arrecadando; leva `*` e cor esmaecida, e fica fora da
  média mensal e do "último mês fechado" da régua.

### 6.9 Duodécimo dos Poderes e Instituições (`src/lib/duodecimo.ts`)

Pedido do dono do produto em 2026-10-16: ver, na aba Receitas, os repasses aos
Poderes pela regra da LDO.

**Regra.** A LDO de 2026 é a Lei nº 4.627/2025, art. 35, com o Anexo III. A de
2025 é a Lei nº 4.380/2024, art. 27, com a mesma regra e os mesmos percentuais.

```
(a) receita = ICMS + IPVA + ITCMD + taxas administrativas + FPE + IRRF
              + IPI-exportação + ICMS-desoneração (LC 87/1996)        — brutos
(b) deduções = municípios (25% ICMS + 50% IPVA + 25% IPI-exportação)
             + PASEP (1% do FPE)
             + educação 30% e saúde 12% de (a − municípios)
(c) receita líquida = (a) − (b);  cada Poder = (c) × percentual
```

Percentuais: Legislativo 6,26%, Judiciário 9,75%, TCE 2,3%, MPAC 5% e DPE 1,5%,
que somam 24,81%.

**O que não está escrito na lei e foi conferido.** O Anexo III é só o modelo da
tabela, sem valores, e não diz sobre qual base incidem os 30% e os 12%, nem o que
são "taxas administrativas". As duas coisas foram decididas reproduzindo a LOA
2026:
- a dotação inicial de fonte 100 de cada Poder no QDD, dividida pelo percentual
  dele, dá a mesma receita líquida nos cinco: R$ 6.042.979.404,43. A ALEAC bate
  no centavo com 6,26%;
- com a previsão do portal, a leitura acima (educação e saúde sobre
  `(a − municípios)`, taxas = só as da fonte do Tesouro) dá R$ 6.042,86 mi, uma
  diferença de 0,002%;
- as outras leituras erram por dezenas de milhões: educação e saúde sobre `(a)`,
  −173 mi; com todas as taxas, +92 mi; educação e saúde sobre `(a − municípios
  − PASEP)`, +33 mi.

O teste `duodecimo.test.ts` guarda essa conferência.

**Cálculo.** É feito mês a mês, sobre o **bruto** arrecadado. A dedução do
FUNDEB do portal não entra, porque a regra já desconta educação e saúde. O
acumulado só soma os meses fechados; o mês em curso aparece marcado e fica fora.

**Duodécimo.** É a dotação **atualizada** de fonte 100 do órgão
(`treasuryAppropriationByOrganization`, `execution-monitor.ts`) dividida por 12,
só quando o QDD carregado é do mesmo ano da receita. É o orçamento
disponibilizado ao Poder, com os créditos suplementares, como manda o art. 168
da Constituição. A dotação inicial aparece ao lado, para mostrar o que a LOA
fixou, e é ela que serve à conferência contra a LOA (`impliedNetForecast`).
Aproximação: a atualizada do ano inteiro é rateada em 12, então um crédito
aberto em setembro pesa também nos meses anteriores. Órgãos: ALEAC `101`, TCE
`102`, TJAC `203`, MPAC `304` e DPE `305`. As fontes próprias dos Poderes
(fundos, taxas judiciais) não entram.

Até 2026-10-16 (commit `1d286b6`), o duodécimo usava a dotação inicial. Passou
para a atualizada a pedido do dono do produto, para medir o orçamento de fato
disponibilizado. No QDD de maio/2026, a diferença era de até R$ 1 mi (MPAC).

**% efetivo** (2026-10-16, pedido do dono do produto: comparar a obrigação legal
com o que está sendo destinado).
- **Fórmula:** duodécimos (dotação atualizada ÷ 12) nos meses fechados ÷ receita
  líquida realizada nos mesmos meses. É a fatia da receita que o orçamento
  disponibilizado ao Poder representa, lado a lado com o % da LDO.
- **Exemplo:** até setembro de 2026, os cinco Poderes somam 23,99% contra
  24,81% na LDO. A receita veio acima da prevista, e o duodécimo é fixo.
- **Cor:** abaixo da LDO fica em `CHANGE_TEXT_COLORS.reduction`; acima, em
  `increase`.
- **Por mês:** os Poderes juntos, com o mês em curso em branco, porque o
  duodécimo inteiro sobre meio mês de receita daria um número sem sentido.

**Por que a dotação basta** (dono do produto, 2026-10-16): para os Poderes sempre
há liberação financeira, então o orçamento de fonte 100 é, na prática, igual ao
financeiro. A dotação atualizada mede o que eles recebem do Tesouro. As
transferências em si não são publicadas (nem no Portal da Transparência, nem na
página da LRF da SEFAZ) e não fazem falta para este bloco. A execução dos Poderes no QDD **não** serve de
substituto, e isso foi conferido em 2026-10-16 no QDD de maio: o TJAC tem zero
empenhado na fonte 100, contra R$ 589 mi de dotação, e a ALEAC tinha R$ 67 mi
pagos contra R$ 165 mi devidos. Para medir o que os Poderes recebem, vale a
dotação, não a execução.

Fora da base, até decisão contrária: a transferência da LC 176/2020 (`171958`),
porque a LDO cita só a LC 87.

## 7. Componentes do módulo

### 7.1 `ExecutionChartCard` (`execution-breakdown-panel.tsx:110-206`)

> **Sem uso desde o redesenho de 2026-10-14** (seção 9, item 27): a grade de
> emendas passou aos gráficos de `execution-visuals.tsx` (seção 7.7). Fica no
> disco, como o `ExecutionTablePanel` (7.2).

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

> **Sem uso desde 2026-10-01**: servia à aba `Tabela`, que continua retirada
> (seção 9, item 26).

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
`variant="execution"`, `actions={dimensionActions}` e `organizations`. O variant adapta o painel para receber filtros externos (órgão,
função, subfunção, busca) em vez de expor os próprios. O painel e a linha da
tabela (`OverviewActionRow`) são `memo` — a lista chega a milhares de linhas.
Não criar um painel de ações paralelo para o módulo; evoluir este. **Só os ramos
`execution` mudam aqui**: `/seplan` e `/secretaria` usam o mesmo painel.

No variant de execução (desde 2026-10-14):

- **Coluna Ação** sem largura fixa (ocupa o resto): nome em `font-medium`,
  **caixa alta** desde 2026-10-15 (pedido do dono do produto; `uppercase` por
  CSS sobre o texto limpo por `readableName`, que preserva acentos e corrige
  espaços; o `title` traz o texto original do QDD) e uma linha de apoio com `{projeto/atividade} · {sigla do órgão} ·
  {unidade}` em `text-xs text-muted-foreground`. As colunas Órgão e Unidade
  saíram para essa linha. O chevron continua abrindo o detalhamento por
  natureza e fonte (`ExpenseBreakdownTable`), com os cinco estágios (inicial,
  atualizado, empenhado, liquidado e pago) desde 2026-10-16: `allStages`, ligado
  só aqui; os orçamentos temáticos seguem com inicial, atualizado e liquidado.
- **Sempre todos os estágios**: Dotação inicial, Dotação atualizada
  (`font-semibold`), Empenhado, Liquidado, Pago e Execução, na ordem do ciclo.
  O modo "essencial" (só atualizada, liquidado e execução, com o botão que
  alternava) saiu em 2026-10-15, com a prop `showAllStages`. Cada coluna
  monetária reserva `10.5rem`; a de execução, `8.5rem`, com anel de 22px
  (`STAGE_COLORS.liquidated`) e o percentual. Cabeçalho e linhas leem a mesma
  lista de colunas (`EXECUTION_MONEY_COLUMNS`).
- **Cabeçalho** `bg-marca text-marca-contraste`, rótulos em caixa alta
  espaçada, `sticky`. Largura mínima compartilhada pelo cabeçalho e pelas
  linhas (`min-w-[82rem]`).
- O contêiner da lista concentra a rolagem vertical e horizontal (R6).

### 7.4 `FiscalSecretariatView` (`fiscal-secretariat-view.tsx`)

Props (todas obrigatórias exceto `organization`): `actions`, `personnelActions`,
`centralPayrollActions`, `personnelScopeLabel`, `personnelScopeNote`,
`organization?`, `organizationCode`, `organizationOptions`, `unitFilter`,
`unitOptions`, `payrollHeadcount: PayrollHeadcountScope | null`, `allValue`,
`onOrganizationChange`, `onUnitChange`, `vigenteImport?`.

Layout (redesenhado em 2026-10-14):

1. **Cabeçalho do órgão**: linha de rótulo `{sigla} · órgão {código} ·
   {periodLabel(vigenteImport)} · {N} ações` ("Acumulado até {mês} de {ano}"
   para `ACUMULADO_ANUAL`; "Mês de {mês} de {ano}" para `MES_ISOLADO`); `h1`
   com o nome legível do órgão (sem a sigla); linha "Orçamento comprometido
   **X%** · disponível para empenho **R$ …**" (`available` do recorte), com o
   `InfoIcon` cujo tooltip é `commitmentHelpText` (seção 6.5 — gerado das fontes
   reais, nunca "fonte 100" fixo: 719 e 721 somam vinculadas). À direita:
   seletores **Secretaria** e **Unidade** (`SearchableCombobox`, unidade
   desabilitada sem órgão), **Apresentar** (fullscreen) e **Imprimir**.
2. **Régua de indicadores** (`KpiStrip`, seção 3.4) com os totais do recorte do
   órgão.
3. **Grade de seis blocos** (`VizBlock`, duas colunas a partir de 1180px):
   - **Folha de pagamento** (seção 6.6): rosca próprio órgão × folha
     centralizada da SEAD, com o total no centro; ao lado, dotação de folha
     (com o nº de ações de cada lado), empenhado e liquidado com anel; a nota
     dos elementos fora do cálculo, com o valor; a nota de escopo
     (`personnelScopeNote`) quando há unidade selecionada; e uma linha de
     **vínculos ativos na folha** (`payrollHeadcount`: total, competência,
     inativos fora do total; "Folha de pagamento indisponível" sem snapshot).
     Sem nenhuma ação de folha no recorte → texto próprio explicando que não
     há ação de folha no órgão nem na folha centralizada 714/002.
   - **Por unidade**: mapa de áreas com cor categórica e legenda das quatro
     maiores; com unidade selecionada, **Por elemento de despesa** da unidade.
   - **Por fonte de recurso**: grade de 100 quadradinhos (cada um vale 1%).
   - **Por categoria econômica**: rosca com o percentual corrente no centro.
   - **Maiores orçamentos**: pirulito das cinco maiores ações.
   - **Sem nenhum valor liquidado** / **Menor execução** (seção 6.5).
   Sem órgão selecionado → `Empty` "Selecione uma secretaria"; órgão sem ação no
   recorte → `Empty` próprio.

Regra interna: **nenhum cálculo no componente que já existe em
`execution-monitor.ts`** — ele importa `aggregateByCategory`,
`aggregateBySource`, `aggregateByAction`, `aggregateByElement`,
`payrollBudgetTotalsOf`, `totalsOf`, `executionRate`, `isCentralPayrollAction`.
A exceção é `aggregateByUnit`, que é local (só existe nesta visão).

### 7.5 `PayrollPanel` (`payroll-panel.tsx`)

Props: `data: PayrollDto`. Sem snapshot → `Empty` "Folha ainda não coletada"
(com a explicação de que a coleta roda diariamente e pode ser disparada no
GitHub). Com snapshot:

- **Cabeçalho**: período ("{mês} de {ano}", capitalize), data da coleta, fonte
  ("Portal da Transparência do Acre"), selo "Somente dados agregados" e aviso de
  vínculos sem tipo definido quando `portalHeadcount > headcount`.
- **Sumário** (`grid-cols-2 lg:grid-cols-4`, divisores `bg-black` com
  `gap-px`): Vínculos classificados, Folha bruta, Descontos, Folha líquida.
- **Distribuição por órgão**: pizza top 8 + fatia "Demais órgãos (N)", em cinza —
  oito porque a paleta categórica tem oito tons e não cicla (até 2026-10-14 eram
  nove); tooltip
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
- `useHoverPill` — sem uso em `/orcamento` desde 2026-10-14 (seção 3.7).
- `formatMoney`, `api`, `getStoredSession`, `clearStoredSession` — de
  `src/lib/api.ts`.
- `organizationAcronym` (`src/lib/organization-acronym.ts`): sigla via override
  (11 códigos: 101 ALEAC, 102 TCE, 203 TJAC, 304 MPAC, 305 DPE, 444 REPAC,
  446 SECC, 447 CASMIL, 450 GABVICE, 452 CEPDEC, 720 SEMA) ou extração do trecho
  após " - " (CAIXA ALTA, ≤ 12 chars); sem derivação possível → código.

### 7.7 Visualizações desenhadas em SVG (`execution-visuals.tsx`)

Desde 2026-10-14 a aba `Gráficos` e a visão `Órgão` usam visualizações
desenhadas à mão em SVG, uma forma por tipo de dado, no lugar das barras de
progresso e dos cartões Recharts. Não é biblioteca nova (seção 10.1): é SVG
escrito no componente, e a geometria mora em `src/lib/chart-geometry.ts`
(funções puras, testadas, que toleram lista vazia e total zero).

- **`KpiStrip`** — régua de indicadores (seção 3.4).
- **`VizBlock`** — bloco da grade: faixa de título `bg-marca
  text-marca-contraste` (`text-sm font-semibold`), frase de leitura
  (`text-[13.5px] text-muted-foreground`, com o número principal em negrito) e
  o gráfico. Sem cartão, sombra nem canto arredondado.
- **`Ring`** — anel de percentual (régua, tabela de ações, folha).
- **`DonutChart`** — rosca com o total no centro e legenda (`ShareLegend`:
  valor compacto e parcela). Composição com poucos itens.
- **`TreemapChart`** — mapa de áreas `squarify`: área = dotação. Cor
  categórica (órgãos, unidades) ou a rampa sequencial de "% executado"
  (`SEQUENTIAL_EXECUTION`, com legenda `SequentialLegend`). Rótulo só quando o
  retângulo comporta o texto; o nome inteiro está no tooltip.
- **`WaffleChart`** — 100 quadradinhos, cada um 1% (`waffleCells`, maior resto).
- **`LollipopList`** — ranking em pirulito (haste fina e ponto), em HTML para
  caber em coluna estreita.
- **`DumbbellChart`** — halteres da dotação: círculo vazado = inicial (lei),
  cheio = atualizada, azul se cresceu e vermelho se caiu (`CHANGE_COLORS`), com o
  saldo à direita (`CHANGE_TEXT_COLORS`). Tooltip com o saldo em destaque e os
  acréscimos e reduções da linha de `BudgetChangeRow` (seção 6.7), com a nota de
  que a coluna do QDD já vem líquida por linha.
- **`BubbleScatter`** — dispersão: X = dotação atualizada, Y = % executado
  (limitado a 100), área da bolha = pago; rótulo nos cinco maiores pagadores.
- **`ChartTooltip`** — **uma** caixa de detalhe para todos os gráficos
  (`useChartTooltip`): subtítulo opcional ("Órgão 744"), título legível, número
  principal grande quando houver, linhas rótulo/valor com marcador da cor da
  série e nota. Posição `fixed` junto ao cursor, presa à janela.

Regras:

- cores sempre de `src/lib/chart-palette.ts`; nunca ciclar a categórica (até
  8 itens, depois `CHART_OTHER`);
- valores de eixo e rótulo com `compactMoney`; tooltip com `formatMoney`
  (por extenso); negativos com o sinal tipográfico "−";
- nomes do QDD passam por `readableName` só para exibição;
- recorte sem dado → `VizEmpty`, com texto concreto do que falta.

Os cartões Recharts da grade anterior (`CycleStackedBarChart`,
`ExecutionScatterChart`, `BudgetChangeChart`, `CycleLineChart`,
`ExecutionChartCard`) ficam no disco, **sem uso** desde 2026-10-14 — como o
`ExecutionTablePanel` desde 2026-10-01. Recharts continua no módulo pela
`PayrollPanel`.

### 7.8 `RevenuePanel` (`revenue-panel.tsx`)

`memo`. Recebe `data` (um `RevenueDto` por ano; `undefined` carregando →
`Skeleton`; lista vazia → estado vazio próprio), `error` (mensagem da rota →
estado vazio com o texto da falha), `pagePadding` e `defaultYear`.

- **Ano das receitas** (`YearSelector`): um botão por ano coletado (`aria-pressed`,
  o ativo em negrito com sublinhado escuro, o mesmo do Recorte), rola na
  horizontal em tela estreita. O ano começa em `defaultYear` (o exercício do
  cabeçalho, `loadedYear`) e, se ele não tiver receita, no mais recente; a
  escolha na aba vale até a página recarregar. Só troca o resumo mostrado.
- **Régua** (`RevenueStrip`): Realizado (anel grande, arrecadado ÷ previsão
  atualizada) · Arrecadado no ano (líquido, com a variação sobre o mesmo
  período do ano anterior) · Previsão atualizada (com a da lei) · último mês
  fechado (com a média mensal) · Deduções (com o bruto).
- **Arrecadação mês a mês** (`MonthlyColumns`): 12 colunas, empilhadas pelo
  líquido de cada grupo (`CHART_CATEGORICAL` 0–2, ordem fixa); largura medida
  com `useMeasuredWidth` (o mesmo hook do halteres). Eixo com marcas redondas
  (`niceScale`, `chart-geometry.ts`: passo de 1, 2, 2,5 ou 5 × 10ⁿ, até quatro
  intervalos); até 2026-10-16 as marcas eram quartos do maior mês e saíam em
  valores quebrados (333,4 mi, 666,7 mi).
  - **Filtro de tributos** (`CategoryFilter`, 2026-10-15): caixa reta de borda
    fina, fundo branco, sem cantos nem sombra, com "TRIBUTOS" em caixa alta e o
    valor ("Todos", em negrito) dentro, mais a seta. Com filtro ativo, a borda e o valor
    escurecem e a seta vira um × que volta a todos. Histórico: o botão
    arredondado dos filtros de Órgão foi recusado (destoava), e só o texto
    sublinhado ficou "escondido". Abre um `Popover` de cantos
    retos e borda fina, sem sombra, com uma caixa de seleção por
    categoria presente no ano, agrupadas, a caixa do grupo (intermediária quando
    parcial), "Marcar todos" e "Desmarcar todos". O valor resume a seleção ("Todos", o nome quando
    é um só, "3 de 19", "Nenhum"). Ao lado, a legenda de cor só dos grupos que
    têm algo marcado. Primeiro as caixas ficavam todas abertas sobre o gráfico;
    o dono do produto pediu a caixa expansível. As colunas somam só as
    marcadas, por grupo (`selectedGroupNet`, seção 6.8), e o eixo se reescala.
    O estado guarda as **desmarcadas**, vive no `MonthlyColumns` e sobrevive à
    troca de ano; categoria nova entra marcada. Nada marcado → estado vazio.
    Vale só para o gráfico: régua e tabela seguem com tudo.
  - Detalhe por mês: com tudo marcado, os grupos, o bruto e as deduções; com
    filtro, cada categoria marcada e o total do mês para comparação.
- **Sem frase de leitura nos dois blocos** (2026-10-15, pedido do dono do
  produto): repetiam a régua e a tabela. A única explicação fica na nota de
  rodapé da tabela (líquido × bruto, mês em curso, fonte, FUNDEB).
- **Receita por tributo** (`RevenueTable`): linhas por grupo (subtotal) e
  tributo, colunas pelos meses consultados + No ano + Previsão atualizada +
  Realizado; valores compactos com o valor por extenso (e o bruto, quando há
  dedução) no `title`. Rola na horizontal com a primeira coluna fixa. Não usa
  `ExecutionTablePanel` (10.13): aquele é de `ExecutionRow` por recorte, e esta
  é uma matriz tributo × mês.

- **Duodécimo dos Poderes e Instituições** (`DuodecimoBlock`, 2026-10-16;
  cálculo na seção 6.9): aparece só em ano com regra em `DUODECIMO_RULES`.
  - Frase de leitura: quanto a receita gerou até o último mês fechado, e quanto
    somam os duodécimos da LOA no período.
  - Primeira tabela, uma linha por Poder: % na LDO, dotação inicial (LOA) e
    atualizada na fonte 100, duodécimo (atualizada ÷ 12), duodécimos até o mês,
    % efetivo (seção 6.9), gerado pela arrecadação até o mês e a diferença com
    sinal.
  - Segunda tabela, "Base de cálculo e valor gerado mês a mês (Anexo III)":
    receita da base, municípios, PASEP, educação, saúde, receita líquida, o %
    efetivo dos duodécimos de todos os Poderes e o gerado para cada Poder, por mês, mais o acumulado e a receita líquida
    implícita na LOA. A composição de cada linha fica no `title`.
  - Sem QDD do mesmo ano, as colunas da LOA mostram "–" e a nota pede para
    trocar o exercício no cabeçalho.
  - A nota de rodapé diz que os valores **não** são as transferências feitas.
  - Recebe `branchAppropriations` da página: um `useMemo` antes do guard de
    sessão (R11).

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

### 8.1 Coleta das receitas — job semanal

`.github/workflows/receitas.yml`:

- `schedule: cron '0 9 * * 1'` (segunda, 09:00 UTC = 04:00 America/Rio_Branco)
  + `workflow_dispatch` com input `ano`; semanal por decisão do dono do
  produto (2026-10-15): a arrecadação não precisa estar no painel no dia;
- `concurrency: group coleta-receitas`; `timeout-minutes: 15`;
- mesmos steps da folha; `node-version: 22` precisa resolver para ≥ 22.18.

`scripts/collect-revenue.mjs` (local: `npm run collect:revenue` em `apps/web`,
lê o `.env.local`):

- sem `--ano`, coleta o ano corrente, o anterior (o portal ainda lança ajustes
  de encerramento no começo do ano) e os exercícios com QDD (`BudgetImport`) —
  cada um até o mês corrente (Rio Branco) ou os 12 meses. A série antiga não
  muda e não é recoletada toda semana;
- `--ano=AAAA` ou `--ano=AAAA-AAAA` (faixa): a série histórica 2016–2025 foi
  carregada assim em 2026-10-15 (`--ano=2016-2026`), 216 agregados por ano;
- `--dry-run` consulta e mostra os totais sem gravar;
- importa `bucketRevenue`/`summarizeRevenue` de `src/lib/revenue.ts` (remoção
  de tipos nativa do Node), então **não há** segunda implementação a manter;
- falha (HTTP, página única estourada, mês sem linhas) aborta só aquele
  exercício, que mantém os dados anteriores; o job sai com erro no fim;
- grava o exercício inteiro numa transação (`deleteMany` + `createMany`).

## 9. Decisões deliberadas (não "corrigir")

1. *(Retirado em 2026-10-14, item 27.)* Era o zoom constante de 95%
   (`PAGE_ZOOM`); saiu com a rolagem da página inteira (R6).
2. **Grade em duas colunas só a partir de 1180px** (`gridClass`): cada bloco
   tem gráfico e legenda lado a lado, e abaixo de ~520px por coluna a legenda
   espreme os nomes. Até 2026-10-01 a grade era 3×2; voltou como 2×2 em
   2026-10-14 (item 26) e, no redesenho do mesmo dia, sem altura fixa: a
   página rola (R6).
3. **Tabelas empilhadas com `shrink-0 max-h-[34rem]`** *(sem uso desde
   2026-10-01, item 26; vale se a aba `Tabela` voltar)* e teto interno
   `max-h-[26rem]`: sem `shrink-0`, cards flex com `min-h-0` encolhem até sobrar
   uma linha visível; os tetos fazem as tabelas rolarem por dentro.
4. **Ticks truncados em 18 caracteres** (`AXIS_TICK_MAX_CHARS`) com largura de
   eixo estimada (`longestTick × 5.4 + 10`, limitada a 120px): calibração
   medida contra a sobreposição real do Recharts, não um chute.
5. **Gráficos `layout="vertical"`**, `barCategoryGap="16%"`, máximo de 100
   barras, omissão de valores zero na métrica escolhida, altura
   `max(170, n × 26 + 34)`.
6. **Régua em 6 colunas só a partir de 1360px**: os valores são por extenso
   (pedido do dono do produto) e chegam a ~190px; em 1280px seis colunas
   cortariam "R$ 10.512.…". Abaixo disso, 3 × 2.
7. **Dimensões fundidas em `Geral`/`Emendas`**: antes havia uma dimensão por
   recorte (elemento, ação, fonte) exibindo os mesmos gráficos em ordens
   diferentes; foram fundidas, e as tabelas de todos os recortes passaram a
   conviver empilhadas na aba `Tabela` (retirada em 2026-10-01, item 26). Não
   recriar dimensões por recorte.
8. **`Órgão` e `Folha` sem linha de filtros**: visões executivas; os filtros
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
16. **A busca do ranking de carreiras não reescala as barras.** A largura
    continua medida contra o maior rendimento médio do ranking **inteiro**
    (`highestAverage` de `rankedRows[0]`, não do resultado filtrado). Buscar uma
    carreira do fim da lista mostra, portanto, uma barra curta: é o valor dela
    perto do topo do estado, e é o ponto de comparação. Reescalar para o filtro
    faria a mesma carreira mudar de tamanho conforme o que se digita. As barras
    do ranking têm uma cor só desde 2026-10-14: a lista passa de oito linhas, e a
    paleta categórica não pode ciclar (`chart-palette.ts`).
17. **A grade da aba `Gráficos` mistura tipos de visualização** (seção 7.7):
    mapa de áreas, rosca, dispersão, halteres e pirulito — uma forma por tipo de
    dado, e não barras em tudo. A escolha de qual recorte usa qual tipo fica
    registrada na seção 3.5.

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
24. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)* Era o vermelho do "Limpar filtros" ativo, que continua no
    código (nota na seção 4).
25. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)* Era a paleta da marca em tokens; o essencial está na seção 4.
26. **A aba `Tabela` foi retirada; a aba `Gráficos` saiu e voltou.** Decisão do
    dono do produto em 2026-10-01: as duas saíram, e o módulo ficou com `Ações`,
    `Órgão` e `Folha de pagamento`. Saíram junto da página a grade `gridClass`,
    as tabelas empilhadas (`STACKED_TABLE_CLASS`), o mapa de cores
    `chartColors`, o `Tabs` interno pela dimensão e as 13 agregações em `useMemo`.
    Em 2026-10-14 o dono do produto pediu `Gráficos` de volta, como grade
    **2×2** e com um cartão novo de créditos adicionais (seção 7.7, tipo 5;
    cálculo na seção 6.7). Voltaram, pelos componentes que tinham ficado no
    disco: `gridClass` (agora 2×2), `chartColors` (só as cores dos cartões de
    emendas), o `Tabs` interno pela dimensão e 8 agregações (elemento, fonte,
    órgão e créditos em `geral`; órgão, ação, elemento e créditos em emendas). Seguem fora: a aba `Tabela`, `STACKED_TABLE_CLASS`
    e o `ExecutionTablePanel` (sem uso, seção 7.2), além de `CycleLineChart`,
    `aggregateByGroup`, `aggregateByModality` e `aggregateByCategory` na grade
    (a visão `Órgão` segue usando `aggregateByCategory`). Recriar `Tabela` é
    mudança de estrutura (seção 10.11), não "restaurar algo que sumiu".

27. **Redesenho de 2026-10-14.** A partir do mockup v7 aprovado pelo dono do
    produto (`mockups/orcamento-redesenho-v7.html`), depois de seis rodadas — as
    anteriores foram recusadas por "cara de painel SaaS" (cartões
    arredondados, sombras, pílulas) e por densidade. Mudou de estrutura: sem
    zoom e com a página rolando (R6); sem trilha lateral, com os filtros numa
    linha e o recorte na faixa de navegação (R5, R7); sem o seletor "Exibir
    valores de"; sem heading, contador e Anterior/Próximo; Exportar na seção de
    ações e o retorno aos Orçamentos Temáticos no cabeçalho. Mudou de forma: a
    régua de indicadores com anéis e valores por extenso, a tabela enxuta com
    nomes legíveis, os gráficos em SVG (seção 7.7) e a visão `Órgão` no mesmo
    molde. Mudou de cálculo só a folha da visão `Órgão` (seção 6.6). Ficaram de
    fora do mockup e seguem como estavam: a `PayrollPanel` (aba Folha de
    pagamento) e a exportação.

28. **Receitas por job semanal e tabela própria** (2026-10-15). O dono do
    produto pediu a aba "pelo portal", desagregada por tributo, no padrão da
    folha e com coleta semanal. O SICAF não foi usado: o pipeline dele coleta só
    o QDD (despesa), e as telas de receita exigiriam reconhecer GeneXus com
    login pessoal. Uma primeira versão lia o portal ao vivo com cache; foi
    trocada pelo job a pedido do dono do produto. A aba fica por último,
    depois do ciclo da despesa (item 15). No mesmo dia entrou a série histórica
    (2016 em diante, também a pedido) com seletor de ano próprio na aba — a
    receita não depende de haver QDD do ano, então não usa o seletor de
    exercício do cabeçalho.

## 10. Proibições explícitas

Violação de qualquer item é motivo para rejeitar a mudança:

1. **Nenhuma biblioteca nova** (gráfico, CSS, utilitário) sem justificativa
   escrita neste documento. Recharts é a única biblioteca de gráficos do módulo.
2. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
3. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
4. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
5. **Nenhum emoji**, nenhum texto em inglês na interface, nenhum texto genérico
   de estado vazio ("Algo deu errado", "Em breve", "Aqui você encontra…").
6. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
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
    elas alimentam. `PayrollSnapshot`/`PayrollGroup` e `RevenueMonth` são
    escritas só pelos jobs de coleta (seção 8), nunca por rota do módulo.
13. **Nenhuma tabela nova ad-hoc com markup próprio** onde `ExecutionTablePanel`
    serve (com `moneyColumns`/`hideRate`). O componente está sem uso desde
    2026-10-01 (seção 9, item 26), mas segue sendo o caminho para qualquer
    tabela de agregação que volte ao módulo.
14. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
15. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
16. *(Retirado em 2026-10-14 junto com o contrato visual — seção 4.)*
17. **Nenhuma mudança declarada pronta sem a verificação da seção 11.** Quando um
    item do checklist não puder ser cumprido — por exemplo, sem navegador para
    conferir as três larguras (item 2) ou o re-render das abas ocultas (item 4) —,
    diga **quais** itens ficaram por verificar em vez
    de omitir. "Compila" e "`tsc` limpo" não são "verificado".

## 11. Checklist antes de encerrar uma mudança

1. `npm run lint` na raiz passa (`tsc --noEmit` sem erros novos).
2. Testado em **três larguras**: ≥ 1360px (régua em 6 colunas, grades em 2),
   1024–1180px (régua 3 × 2, grades em 1 coluna), < `sm` (régua 2 colunas,
   filtros quebrando linha, abas rolando).
3. Navegação por setas ← → funciona e **ignora** inputs, selects, comboboxes,
   caixas de seleção (`role="checkbox"`, filtro da aba Receitas) e abas
   internas por tema (o guard do handler deve continuar intacto).
4. Abas não piscam ao alternar (`forceMount` mantido); `React DevTools` (ou
   profiler) não mostra re-render das abas ocultas em troca de recorte/filtro
   (`memo` mantido).
5. Filtros em cascata: órgão limpa unidade+fonte; unidade limpa fonte; "Limpar
   filtros" desabilita quando limpo; opções de unidade/fonte refletem o recorte.
   **Trocar o exercício limpa órgão+unidade+fonte+função+subfunção+busca**, e as
   opções passam a refletir apenas o QDD do ano escolhido.
6. Somatórios conferem: para o QDD vigente, a soma dos buckets de cada
   agregação em uso (hoje, as da visão `Órgão` — categoria, fonte, ação e
   elemento — e as da aba `Gráficos` — elemento, fonte, órgão, ação e créditos
   adicionais, cujo `netChange` fecha com atualizada − inicial, seção 6.7; os
   "Demais" de rosca e quadradinhos fecham com o total real) fecha
   com o total geral (nada descartado, nada duplicado) — e isso
   vale **em cada exercício**, não só no corrente.
7. Textos novos em pt-BR, com `formatMoney`/`compactMoney` em valores.
8. Estado vazio e `Skeleton` cobertos para o que foi alterado; estados vazios
   com texto concreto.
9. Se a mudança tocou base de cálculo ou catálogo manual: seções 6/9/12 deste
   documento atualizadas.
10. Se a mudança mexeu na coleta da folha: `payroll-portal.ts` **e**
    `collect-payroll.mjs` alterados juntos; job manual disparado uma vez contra
    o mês vigente e resultado conferido no painel.

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
| Regra do duodécimo por exercício (lei, órgãos, percentuais) | `DUODECIMO_RULES` (`src/lib/duodecimo.ts`) | LDO nova: conferir os percentuais e o Anexo III e refazer a conferência contra a LOA (seção 6.9) |
| Siglas de órgão | `ACRONYM_OVERRIDES` (`organization-acronym.ts:10-23`) | órgão sem sigla extraível do nome |
| Categorias de receita por natureza (tributos, transferências) | `REVENUE_NATURE_PREFIXES` e `revenueNatureEra` (`src/lib/revenue.ts`) | natureza nova relevante que hoje cai em "Outras…", ou nova reorganização da STN (nova estrutura = nova era, com o ano de corte); o primeiro prefixo que casa vence, então o específico vai antes do genérico. Depois de mudar, recolete os anos afetados (`--ano=`) |
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
- As receitas dependem do endpoint interno `/receitas/listar` do portal, que não
  é contrato público; uma mudança nele derruba o job semanal até ser detectada
  (os dados anteriores ficam). Se o portal passar de 5.000 linhas num mês, a
  coleta falha em vez de somar só a primeira página. Com coleta semanal, o
  painel pode estar até uma semana atrás do portal; o rodapé da aba mostra a
  data da coleta.
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
| `src/lib/execution-export.ts` | exportação XLSX/CSV/JSON do recorte filtrado (client-side) |
| `src/lib/organization-acronym.ts` | siglas |
| `src/components/domain/execution-breakdown-panel.tsx` | cartões da aba `Gráficos`: `ExecutionChartCard`, gráficos do ciclo, dispersão e `BudgetChangeChart`; `ExecutionTablePanel` sem uso desde 2026-10-01 (seção 9, item 26) |
| `src/components/domain/fiscal-secretariat-view.tsx` | visão por órgão |
| `src/components/domain/payroll-panel.tsx` | painel da folha |
| `src/lib/revenue.ts` | classificação da receita por tributo, agregação mensal e resumo (puro; usado pela rota e pelo job) |
| `scripts/collect-revenue.mjs` | job semanal: portal → `RevenueMonth` |
| `src/components/domain/revenue-panel.tsx` | aba Receitas |
| `src/components/domain/overview-scheduled-actions-panel.tsx` | aba Ações (variant execution) |
| `src/lib/payroll-scope.ts` | escopo QDD × portal, vínculos |
| `src/lib/payroll-portal.ts` | coleta server-only |
| `scripts/collect-payroll.mjs` | coleta standalone (CI) |
| `.github/workflows/folha.yml` | agendamento da coleta |
| `src/app/api/payroll/route.ts` | leitura da folha (agregados) |
| `src/app/api/budget-actions/route.ts` + `src/lib/store.ts:129` | carga das ações do QDD vigente |

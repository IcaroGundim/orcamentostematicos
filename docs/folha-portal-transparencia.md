# Folha de pagamento do Acre — fonte, integração e granularidade

Referência técnica para quem vai construir um **sistema próprio da folha**, separado
do sistema de Orçamentos Temáticos. Reúne três coisas:

1. como o sistema de orçamento chega hoje aos dados do Portal da Transparência;
2. como ele liga esses dados ao QDD (o orçamento);
3. o que o portal realmente oferece, e em que granularidade.

**Procedência das afirmações.** Cada fato vem marcado com a sua origem:

- **[portal 22/09/2026]** — conferido por requisição direta ao portal nessa data;
- **[código]** — lido no código deste repositório (caminhos relativos a `apps/web/`);
- **[não testado]** — hipótese ou coisa vista sem ser exercitada. Conferir antes de
  construir em cima.

Nenhum dado pessoal (nome, matrícula, valores de uma pessoa) foi reproduzido aqui.

---

## 1. A fonte

- Portal: `https://transparencia.ac.gov.br/servidores`.
- Aplicação Laravel com tabela DataTables *server-side*: a própria página consome uma
  API JSON interna. **Não há API documentada nem arquivo de dados abertos** —
  é um endpoint interno, não um contrato público, e pode mudar sem aviso. [código]
- `robots.txt` com `Disallow:` vazio e rodapé com licença aberta — por isso a coleta
  automatizada foi considerada legítima. [código, comentário em `src/lib/payroll-portal.ts`]
- O seletor de ano da página oferece **1996 a 2026**. [portal 22/09/2026] Se os anos
  antigos têm dados de fato é **[não testado]**.
- A folha é publicada **mensalmente e com atraso**: o mês corrente normalmente ainda
  está vazio. [código]
- Tamanho da base: 58.132 vínculos em 07/2026 [portal 22/09/2026]; 53.985 em 01/2026
  [código, comentário].

## 2. Como o sistema de orçamento chega ao portal

### 2.1 Receita de requisição

Toda chamada exige **sessão + CSRF da mesma sessão**. [código]

**Passo 1 — abrir sessão**

```
GET https://transparencia.ac.gov.br/servidores
```

- extrair o token de `<meta name="csrf-token" content="...">` do HTML;
- guardar os cookies de `Set-Cookie` (só o par `nome=valor`, antes do `;`).

**Passo 2 — listar vínculos**

```
POST https://transparencia.ac.gov.br/servidores/listar
Headers:
  Accept: application/json
  X-Requested-With: XMLHttpRequest
  X-CSRF-TOKEN: <token>
  Content-Type: application/x-www-form-urlencoded; charset=UTF-8
  Referer: https://transparencia.ac.gov.br/servidores
  Cookie: <cookies>
  User-Agent: <identificação do coletor>
Body (form):
  draw=1  start=<offset>  length=<tamanho da página>
  ano=<AAAA>  mes=<1-12>
  orgao=  filtro=  busca=  situacao=  tipo_contrato=<tipo>
  admissao=  exoneracao=
  order[0][column]=0  order[0][dir]=asc
```

Resposta: `{ draw, recordsTotal, recordsFiltered, data: [ ... ] }`. [portal 22/09/2026]

**Passo 3 — detalhamento de um vínculo (contracheque)**

```
POST https://transparencia.ac.gov.br/servidores/detalhamento
(mesmos headers)
Body (form):
  id=<matrícula>   contrato=<nº sequencial do vínculo>
  ano=<AAAA>  mes=<1-12>
  orgao=  filtro=  busca=  situacao=0
```

- A chave é **`id`, e ela recebe a matrícula**. Enviar `matricula=` devolve lista
  vazia, sem erro. [portal 22/09/2026] Foi assim que a primeira tentativa falhou.
- Resposta: um **array**, com um item por folha do mês (ver 4.2). [portal 22/09/2026]
- Os nomes dos campos vêm do JS da própria página: o link de cada linha carrega
  `data-id="${matricula}"` e `data-contrato="${contrato}"`. [portal 22/09/2026]

**Outros endpoints vistos, não exercitados** [não testado]:

- `/servidores/detalhamento-pdf` — citado no JS da página; provavelmente o
  contracheque em PDF;
- `/servidores/contratos` — citado em comentário do código como origem da lista de
  tipos de contrato.

### 2.2 Armadilhas do endpoint

Todas encontradas na prática:

- **O campo `contrato` da linha não é o tipo de contrato.** É o número sequencial do
  vínculo daquela matrícula (1, 2, …). O tipo só existe como **filtro de entrada**,
  por isso a coleta faz **uma varredura por tipo**. [código]
- **Filtrar por tipo vazio devolve a base inteira**, não "os sem tipo". Por isso os
  poucos vínculos sem tipo definido não podem ser isolados. A diferença é medida à
  parte: 2 em 53.985 em 01/2026. [código]
- **Linha = vínculo, não pessoa.** Uma matrícula pode ter vários vínculos (`contrato`
  1, 2…). Contagem de linhas ≠ contagem de servidores. [portal 22/09/2026]
- **O bruto da listagem é a soma de todas as folhas do mês**, não só da NORMAL. Nas 6
  amostras conferidas, o `valor_bruto` da listagem foi igual à soma dos brutos de
  ADIANTAMENTO (1ª) + COMPLEMENTAR (1ª) + NORMAL (1ª) do detalhamento. Consequência:
  **meses com adiantamento de 13º ficam inflados** em qualquer série mensal feita
  pela listagem. [portal 22/09/2026, amostra de 6 vínculos]
- Dentro de cada folha, **a soma das rubricas de crédito (`tipo = C`) é igual ao
  bruto daquela folha**. [portal 22/09/2026, mesma amostra]
- **Inatividade vem de `situacao`**, nunca do tipo de contrato nem do órgão:
  - ~14,5 mil aposentados constam como `EFETIVO`;
  - ~48 servidores trabalham de fato no Instituto de Previdência;
  - ~690 inativos estão lotados noutros órgãos. [código, comentário]
  - Valores observados: `ATIVO`, `INATIVO`, `PENSIONISTA`, `EXONERADO/RESCISO`. [código]
- **Texto vem com espaços de preenchimento à direita.** Normalizar colapsando
  espaços. [código]
- **Valores monetários vêm como string** (`"1234.56"`). [portal 22/09/2026]
- **O portal derruba conexões esporádicas em páginas grandes.** A coleta usa até 4
  tentativas com espera de 2s/4s/8s e timeout de 120s por requisição. [código,
  `scripts/collect-payroll.mjs`]
- **Página de 5.000 registros** responde em ~4s; acima disso o payload pesa. Há pausa
  de 700 ms entre requisições. [código]

### 2.3 O job de coleta

- **Workflow:** `.github/workflows/folha.yml`. [código]
  - roda todo dia às 07:30 UTC (04:30 em Rio Branco);
  - aceita `workflow_dispatch` com `ano`/`mes`;
  - `concurrency: coleta-folha` sem cancelar a coleta em andamento;
  - timeout de 20 min;
  - `npm ci` → `prisma generate` (com `working-directory: apps/web`) →
    `node apps/web/scripts/collect-payroll.mjs`.
- **Mês de referência:** sem `--ano/--mes`, volta do mês atual até 6 meses e pega o
  primeiro com `recordsTotal > 0`. [código]
- **Varredura:** para cada um dos 8 tipos (`COMISSÃO`, `CONTRATO CLT`, `EFETIVO`,
  `EFETIVO/COMISSÃO`, `ELETIVO`, `ESTAGIÁRIO`, `PENSIONISTA`, `TEMPORÁRIO`), pagina a
  listagem até `recordsTotal`. São cerca de 16 requisições no total. Ao final faz uma
  chamada sem filtro e grava `portalHeadcount`, para a diferença ficar auditável.
  [código]
- **Somente agregados saem do script.** Nome e matrícula são lidos e descartados em
  memória. [código]
- **Existem duas implementações da mesma coleta**, que precisam ser mantidas
  idênticas à mão (`docs/design-orcamento.md` §8):
  - `src/lib/payroll-portal.ts` (dentro do Next);
  - `scripts/collect-payroll.mjs` (CLI, é a que o job usa). [código]

### 2.4 Persistência

`prisma/schema.prisma` [código]:

- `PayrollSnapshot` — um por `(year, month)`, único:
  - `headcount`, `portalHeadcount`;
  - `grossTotal`, `deductionsTotal`, `netTotal`;
  - `collectedAt`.
- `PayrollGroup` — agregados do snapshot:
  - campos `dimension`, `key`, `secondaryKey`, `headcount`, bruto, descontos e líquido.

| `dimension` | `key` | `secondaryKey` |
|---|---|---|
| `CONTRACT_TYPE` | tipo de contrato | — |
| `ORGANIZATION` | nome do órgão (como o portal escreve) | — |
| `CAREER` | cargo efetivo; se vazio, cargo em comissão | `situacao` |
| `ORGANIZATION_CONTRACT` | nome do órgão | tipo de contrato |

A gravação é **transacional e idempotente**: `deleteMany` do mês, depois `create` do
snapshot, depois `createMany` dos grupos. Ou o mês novo entra inteiro, ou o anterior
permanece. [código]

### 2.5 Leitura

- `GET /api/payroll` (`src/app/api/payroll/route.ts`) devolve **só o snapshot mais
  recente**, separado por dimensão. Acesso restrito a `SEPLAN_ADMIN`. [código]
- A tela `/orcamento` busca essa rota em paralelo, com `catch` próprio: se a folha
  falhar, o resto do painel carrega. A aba "Folha de pagamento" usa
  `src/components/domain/payroll-panel.tsx`. [código]
- A folha **não segue o seletor de exercício**: mostra sempre o mês mais recente
  publicado. [código / README]

## 3. Como a folha se liga ao orçamento (QDD)

**Não existe chave comum entre as duas fontes.** O portal publica por **nome** de
órgão, sem os códigos de órgão/unidade do QDD. Também não traz programa, ação nem
fonte de recurso. A ligação é feita por três pontes, todas manuais ou por regra.
[código]

### 3.1 Ponte 1 — mapa órgão/unidade do QDD → nome no portal

- `src/lib/payroll-scope.ts`, constante `PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE`.
- É um mapa auditado de `"{órgão}/{unidade}"` para nome(s) do portal. Exemplos:
  - `721/001` → `SECRETARIA DE ESTADO DE SAUDE`;
  - `721/302` → `HOSPITAL DAS CLINICAS DO ACRE`;
  - `762/001` → `SECRETARIA DE ESTADO DA MULHER`.
- Hoje tem cerca de 65 entradas.
- Existe para impedir que uma aproximação textual atribua vínculos à unidade errada.
- `payrollHeadcountForQddScope(payroll, orgCode, unitFilter, ...)`:
  - resolve os nomes do escopo: todas as unidades do órgão, ou só a unidade exata;
  - normaliza os nomes: sem acento, caixa alta, espaços colapsados;
  - cruza com `ORGANIZATION`/`ORGANIZATION_CONTRACT`.
- Caso especial `714|002` (SEAD, folha centralizada): usa a **folha estadual
  consolidada** inteira.
- Sem correspondência no mapa, devolve `headcount: null`. É ausência explícita, nunca
  um palpite.
- **Manutenção:** quando um órgão muda de nome no portal ou uma unidade nova aparece
  no QDD, o mapa precisa ser atualizado à mão. Até lá, aquela unidade fica sem folha.

### 3.2 Ponte 2 — ações de folha centralizada no QDD

- `src/lib/execution-monitor.ts`: `isCentralPayrollAction`,
  `centralPayrollActionsForTargets`, `CENTRAL_PAYROLL_SCOPES`.
- A folha de várias secretarias é executada nas unidades **714/002** (SEAD) e
  **714/607** (SESACRE/FUNDES), em ações com "folha de pagamento" na aplicação
  programada.
- A atribuição à secretaria beneficiária usa um **mapa de códigos de
  projeto/atividade** (ex.: `20260000` → SEGOV). O código da ação é estável ao longo
  do exercício; o nome e o vínculo administrativo, não.
  - `null` significa "sem rateio" (ex.: `80000000`, inativos e pensionistas).
  - Fallback textual (nome ≥ 6 caracteres ou sigla como palavra) só depois do mapa.

### 3.3 Ponte 3 — custo de pessoal visto pelo QDD

`personnelTotalsOf` em `execution-monitor.ts` [código] soma:

- todas as linhas de **GND 1**; e
- linhas de GND 3 com elemento em `{08, 13, 36, 46, 47, 48, 49, 92, 93, 94}`
  (auxílios, benefícios, indenizações, DEA, obrigações patronais), **só quando** a
  ação é de "folha de pagamento".

Esse é o lado **orçamentário** (dotação, empenhado, liquidado, pago). O portal dá o
lado **nominal** (quem recebeu quanto). As duas somas **não precisam fechar**: há
encargos patronais, competências diferentes, 13º e rubricas indenizatórias.

### 3.4 Ponto de atenção — inativos na contagem por órgão

> **Divergência entre documento e código.** Não corrigida; registrada aqui.

- `docs/design-orcamento.md` §6.6 diz que inativos são excluídos pela `situacao` do
  portal.
- No código:
  - `collect-payroll.mjs` grava `ORGANIZATION_CONTRACT` com
    `secondaryKey = tipo de contrato`, **não** situação;
  - `aggregateContracts` (`payroll-scope.ts`) aplica `isInactiveContract`
    (APOSENT/PENSION/INATIV) sobre esse `secondaryKey`.
  - Na prática, **só o tipo `PENSIONISTA` é excluído**.
- Efeito:
  - aposentados cadastrados como `EFETIVO` entram como ativos na contagem de
    `payrollHeadcountForQddScope`;
  - isso inclui o Instituto de Previdência (`714/211`) e o total estadual de
    `714|002`, onde estão os ~14,5 mil do comentário.
- A dimensão `CAREER` guarda `situacao` corretamente; só o cruzamento órgão × tipo
  não guarda.
- Correção provável: gravar a situação também no cruzamento por órgão, por exemplo
  numa dimensão `ORGANIZATION_SITUATION`, e usá-la na exclusão. Depende de decisão do
  responsável pelo painel.

## 4. Granularidade disponível

### 4.1 Na listagem (`/servidores/listar`) — já baixada inteira pela coleta

Uma linha por **vínculo × mês**. Campos [portal 22/09/2026]:

| Campo | Conteúdo | Usado hoje? |
|---|---|---|
| `nome` | nome do servidor | não (descartado) |
| `matricula` | matrícula | não (descartado) |
| `contrato` | nº sequencial do vínculo | não |
| `orgao` | nome do órgão | **sim** |
| `lotacao` | local de trabalho (escola, batalhão, hospital, divisão…) | não |
| `cargo_efetivo` | cargo efetivo | **sim** (carreira) |
| `cargo_comissao` | cargo em comissão | **sim** (fallback da carreira) |
| `situacao` | ATIVO / INATIVO / PENSIONISTA / EXONERADO | **sim** (só na carreira) |
| `admissao` | data de admissão | não |
| `exoneracao` | data de exoneração | não |
| `carga_horaria_tabela` | carga horária de tabela | não |
| `carga_horaria` | carga horária | não (veio vazio na amostra) |
| `valor_bruto`, `valor_desconto`, `valor_liquido` | soma de todas as folhas do mês | **sim** |
| `verbas_formatada` | rubricas | não (**vem vazio na listagem**) |

- **Lotação** é bem mais fina que órgão. Uma amostra de 200 vínculos ativos trouxe
  139 lotações distintas. [portal 22/09/2026] É uma amostra só: não projetar para a
  base inteira.
- Agregar por lotação, admissão ou exoneração **não custa nenhuma requisição a
  mais**: os campos já chegam na varredura atual.

### 4.2 No detalhamento (`/servidores/detalhamento`) — uma chamada por vínculo

Um item **por folha do mês** do vínculo. Campos [portal 22/09/2026]:

- identificação e lotação:
  - `nome`, `matricula`, `contrato`;
  - `ano`, `mes`;
  - `orgao`, `sigla`;
  - `lotacao`, `sigla_lotacao`;
- cargo e enquadramento:
  - `cargo_efetivo`, `cargo_comissao`, `tipo_contrato` (aqui o tipo vem explícito);
  - `classe`, `sigla_classe`, `referencia`, `sigla_referencia`;
- jornada:
  - `ch_efetivo`, `ch_comissao`, `ch_semanal`, `carga_horaria`;
- situação e datas:
  - `situacao`, `admissao`, `exoneracao`;
- folha:
  - **`tipo_folha`** — valores vistos: `NORMAL (1ª)`, `ADIANTAMENTO (1ª)`,
    `COMPLENTAR (1ª)` (grafado assim pelo portal);
  - `valor_bruto`, `valor_desconto`, `valor_liquido` — agora **por folha**;
- rubricas:
  - `verbas` (bruto) e **`verbas_formatada`** — uma entrada por rubrica, com:
    - `cod` — código da rubrica;
    - `descricao` — ex.: "PROVENTO-MEDIA EC 41/2003", "AUXILIO-SAUDE INATIVOS",
      "IRRF", "ADIANTAMENTO DE 13 SALARIO", "OUTROS DESCONTOS";
    - `tipo` — `C` crédito / `D` débito;
    - `valor`;
    - `total_caracteres`, `total_caracteres_utf` (sem uso aparente).
  - Há rubricas **sem código** (ex.: "OUTROS DESCONTOS").

### 4.3 Custo de ir até a rubrica

- Uma chamada de detalhamento por vínculo: **~58 mil chamadas por mês**.
- Com a pausa atual de 700 ms, só as pausas somam **~11h por mês**. É um piso: o
  tempo de resposta e as retentativas vêm por cima.
- Cobrir **histórico** multiplica isso por cada mês. Pesa no portal. Precisa de
  política de cortesia (horário, concorrência 1, pausa) e de retomada incremental.

### 4.4 O que o portal não tem

- **Código de órgão/unidade do QDD, programa, ação, fonte de recurso.** Não há como
  dizer qual ação orçamentária paga cada vínculo.
- **Sexo, idade, raça/cor, escolaridade.** Limita o uso da folha para o OSG.
- **Município como campo.** Às vezes aparece dentro do texto da lotação
  (ex.: "…6ºBPM CRUZEIRO DO SUL"), mas isso seria dedução a partir do texto, não um
  dado.
- **CPF.** Não visto nas respostas. [portal 22/09/2026]

## 5. Para um sistema próprio da folha

### 5.1 Fatos que valem para qualquer desenho

- **Banco novo e separado.** O `DATABASE_URL` do orçamento é produção: um único
  branch Neon, retenção de ~6h, e já houve perda de curadoria. O sistema da folha não
  deve escrever nele.
- **User-Agent próprio**, que identifique o novo coletor. O atual é
  `SEPLAN-AC-OrcamentosTematicos/1.0`.
- **Uma única implementação do coletor.** Hoje são duas (lib + script) mantidas
  idênticas à mão. O sistema novo não deve herdar isso.
- **Coleta fora do servidor web.** No orçamento ela roda no GitHub Actions (sessão,
  TLS e tempo longo), e as rotas da Vercel têm `maxDuration = 60`.
- **Transação por mês + conferência com `portalHeadcount`** funcionaram bem.
- **Guardar a situação em todo cruzamento**, e não só na carreira (ver 3.4).
- **Tratar `tipo_folha` como dimensão**: sem isso, todo julho/dezembro aparece como
  salto na série.
- **O portal pode mudar sem aviso.** O parser deve ser defensivo e falhar alto (sem
  token, sem campos esperados, total zerado), nunca gravar vazio.

### 5.2 Decisões em aberto (do responsável pelo projeto)

1. **Microdado ou agregado?** Guardar por vínculo (com nome/matrícula) permite
   séries por pessoa, rotatividade e reconciliação. Mas é tratamento de dado pessoal,
   com obrigações da LGPD, **mesmo sendo dado já público**. Hoje o orçamento guarda só
   agregados. Meio-termo possível: guardar por vínculo com a matrícula
   pseudonimizada (hash com segredo), sem nome.
2. **Rubricas para a base toda ou por amostra/órgão?** Ver 4.3.
3. **Até onde ir no histórico?** O seletor vai até 1996; os dados reais precisam ser
   conferidos (ver seção 1).
4. **Contrato com o orçamento.** Se o painel `/orcamento` continuar mostrando a
   folha:
   - ou ele passa a consumir uma API de agregados do sistema novo;
   - ou o coletor atual continua lá.
   - Em qualquer caso, o mapa QDD → portal (seção 3.1) precisa de um dono.
5. **Granularidade organizacional:** órgão, lotação ou as duas. A lotação é mais
   rica, mas não tem código e muda de nome.

## 6. Referência rápida de arquivos (no repositório do orçamento)

| Arquivo | Papel |
|---|---|
| `apps/web/scripts/collect-payroll.mjs` | coletor usado pelo job (CLI) |
| `apps/web/src/lib/payroll-portal.ts` | mesma coleta, versão da lib |
| `.github/workflows/folha.yml` | agendamento diário |
| `apps/web/prisma/schema.prisma` | `PayrollSnapshot`, `PayrollGroup`, `PayrollDimension` |
| `apps/web/src/app/api/payroll/route.ts` | leitura do snapshot mais recente |
| `apps/web/src/lib/payroll-scope.ts` | mapa QDD → portal e contagem por escopo |
| `apps/web/src/lib/execution-monitor.ts` | folha centralizada e custo de pessoal do QDD |
| `apps/web/src/components/domain/payroll-panel.tsx` | aba "Folha de pagamento" |
| `docs/design-orcamento.md` §6.6 e §8 | contrato da folha dentro do painel |

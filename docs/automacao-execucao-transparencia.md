# Automatizar a execução via API do Portal da Transparência — parecer técnico

**Data:** 2026-08-20 · **Escopo:** viabilidade de alimentar automaticamente as colunas de
execução (`committed`/`liquidated`/`paid`) do Orçamentos Temáticos a partir de
`transparencia.ac.gov.br`, em vez de depender do upload manual do QDD.

**Veredito: parcialmente, sim.** A execução é automatizável com chave de junção exata e
cobertura verificada. A **dotação não é** — o portal não a publica. A importação do QDD
continua obrigatória; a API vira uma camada de *atualização* entre importações.

---

## 1. O que foi verificado empiricamente (não é leitura de documentação)

Todos os números abaixo saíram de requisições reais em 2026-08-20 e de consultas
somente-leitura ao banco de produção.

### 1.1 A API funciona e é rápida

- CSRF obtido de `/despesas-por-classificacao`; endpoints respondem JSON sem autenticação.
- **1.630 requisições em 16 s** (10 threads) para varrer todas as ações de 2026.
- Exercícios disponíveis: **1996 a 2026**.

### 1.2 A chave de junção é exata

`BudgetAction.functionalProgram` **é** o código de 17 dígitos que o portal usa no filtro
`programa`. Nas 1.728 ações do QDD VIGENTE de 2026:

| Verificação | Resultado |
| --- | --- |
| `functionalProgram` com exatamente 17 dígitos | 1728/1728 |
| `functionalProgram` termina em `projectActivity` | 1728/1728 |
| `(org, unidade, projectActivity)` é único | **1728 distintos, 0 duplicados** |

A última linha é a pré-condição que torna a junção possível: a API **nunca** devolve
`Aplicação Programada`, então o `actionLogicalKey` completo não é reconstruível. Como a
tripla `(org, unidade, projectActivity)` é única, `application` é redundante para o
casamento — mas isso precisa ser **reconferido a cada exercício**, não presumido.

### 1.3 O `programa` sozinho não é granular o bastante

- **95** ações do QDD 2026 compartilham o mesmo código de 17 dígitos com outra ação.
- **45** códigos abrangem mais de um par `(órgão, unidade)` na API.

Conclusão de desenho: `POST /despesas/totais` com `programa` **não serve** (agrega entre
órgãos). É preciso `POST /despesas-por-classificacao/listar`, que devolve `completo`
(`"714 - SEAD"`) e `unidade` por empenho, e agregar no cliente por
`(programa, órgão, unidade)`.

### 1.4 A varredura por `programa` cobre 100% do que o portal publica

Varredura completa dos 6.483 códigos em 2025, somando `/despesas/totais`:

```
SOMA empenhado = 12.163.097.942,81   portal = 12.163.097.942,81
SOMA liquidado = 12.043.051.258,12   portal = 12.043.051.258,12
SOMA pago      = 12.014.722.210,70   portal = 12.014.722.210,70
```

Bate ao centavo nos três agregados: dentro do universo do portal, não há despesa fora da
classificação por ação. Esse universo, porém, **não é o Estado inteiro** — ele exclui três
Poderes (§1.6).

### 1.5 A junção real com o QDD

QDD VIGENTE de 2026 (`QDD_Saldo_Retroativo_Execucao-1425-20260804.xls`, 04/08) × API (hoje):

| | |
| --- | --- |
| Ações casadas por `(programa, órgão, unidade)` | **1026 / 1728** |
| Não casadas com empenhado = 0 no QDD (corretamente ausentes do portal) | 672 |
| **Cobertura sobre as ações que têm execução** | **1026 / 1056 = 97,2%** |
| Liquidado por ação: API > QDD / = / < | 392 / 632 / **2** |
| Empenhado por ação: API > QDD / = / < | 339 / 664 / **23** |

As 664 igualdades exatas em empenhado (sobre 1026 casadas) confirmam a semântica do campo:
`totalempenho` da API já vem líquido de anulações — é o análogo de
`Empenhado + Complementado (C)` do QDD, **não** de `valorempenhado`.

**Os valores não são monotônicos.** As 23 quedas em empenhado e 2 em liquidado foram
inspecionadas e são anulações reais posteriores a 04/08 — inclusive uma emenda
(717/303, `13392229280285822`) que caiu de R$ 40.000 para R$ 0. Qualquer guarda que trate
queda como erro vai gerar falso positivo, e "manter o valor do QDD quando a API for menor"
congelaria estornos legítimos.

### 1.6 O buraco de cobertura tem nome: os outros Poderes

As 30 ações com execução no QDD e sem par na API somam **R$ 722.839.495,89** e pertencem a
três órgãos apenas:

| Órgão | Empenhado 2026 |
| --- | --- |
| 101 — Assembleia Legislativa | R$ 359.803.576 |
| 203 — Poder Judiciário | R$ 224.281.650 |
| 102 — Tribunal de Contas | R$ 138.754.270 |

O módulo de despesas do portal cobre **Executivo + Ministério Público + Defensoria**
(90 órgãos com despesa em 2026) e **não** ALEAC, TCE nem TJAC. Para esses três, só o QDD.

---

## 2. O que a API NÃO entrega

| Campo do modelo | Situação |
| --- | --- |
| `initialBudget`, `supplemented`, `updatedBudget` | **Ausente.** O portal não publica dotação. A navegação só linka LOA/PPA em PDF no site da SEPLAN. |
| `available` (`updatedBudget - liquidated`) | Derivado da dotação → depende do QDD. |
| `application` (Aplicação Programada) | Ausente. Contornável (§1.2). |
| `ExpenseLine.reduced` | Ausente. |
| `committed`, `liquidated`, `paid` | **Disponível**, por empenho. |
| `source` (fonte), `expenseAccount` (natureza) | Disponíveis por empenho (`fonterecurso`, `despesaorcamentaria`) — dá para reconstruir a execução por fonte/elemento, mas nunca a dotação por linha. |

Bônus não previsto: cada empenho traz `razaosocial`, `cpfcnpjcredor`, `historico`
(objeto literal), `dataempenho` e `numeroprocesso` — granularidade que o QDD não tem.

---

## 3. Desenho recomendado (se for adiante)

1. **Atualizar no lugar, nunca criar `BudgetImport`.** Escrever `committed`/`liquidated`/`paid`
   nas ações da importação VIGENTE resolvida por `getVigenteImportId(year)`. Criar uma
   importação nova dispararia `remapAssignments`/`reattachOrphanAssignmentsToVigente` e
   colidiria com a invariante de um QDD VIGENTE por ano.
2. **Preservar as colunas de dotação.** `initialBudget`/`supplemented`/`updatedBudget` são
   do QDD e o job não pode tocá-las. `available` recalculado como
   `updatedBudget − liquidated`.
3. **`periodo=0`** (acumulado do exercício), que é como as colunas de execução do QDD
   acumulam. `mes` daria um mês isolado.
4. **Não zerar o que não veio — mas aceitar queda no que veio.** Ação **sem par** na API
   mantém os valores do QDD (senão os R$ 722 M dos outros Poderes viram zero na tela). Ação
   **com par** recebe o valor da API mesmo quando ele é menor: estorno e anulação são
   execução real (§1.5), não erro de coleta.
5. **Marcar a procedência.** A tela precisa distinguir "execução do QDD de 04/08" de
   "execução do portal de hoje", ou a conferência da SEPLAN perde o chão.
6. **Não rodar em exercício `comparisonOnly`** sem revisar o gate — e jamais deixar
   `ensureMissingAssignmentValidations` rodar no caminho do job.
7. **Guarda de sanidade:** abortar se a tripla `(org, unidade, projectActivity)` deixar de
   ser única, ou se a cobertura casada cair abaixo de um piso. **Não** usar queda de valor
   como critério de aborto (§1.5) — no máximo, registrar em log para conferência.

---

## 4. Riscos

- **Endpoints internos, não documentados, atrás de CSRF.** São o backend dos DataTables do
  portal; podem mudar de forma ou de contrato sem aviso. Não há SLA nem versionamento.
- **Sem contrato de rate limit.** 1.630 requisições em 16 s passaram, mas nada garante que
  continuem passando. Um job diário fora do horário de pico e com backoff é o mínimo.
- **A lista de `programa` do portal é global e desatualizada:** 604 dos 1.630 códigos do QDD
  2026 não aparecem no `<select>`, embora o filtro funcione para eles. Iterar sobre os
  códigos do **QDD**, nunca sobre o dropdown.
- **Divergência de retrato.** O QDD e o portal saem do mesmo SIAFE/SAFIRA, mas em datas
  diferentes; misturar os dois numa mesma linha sem sinalizar induz a erro de leitura.

---

## 5. Achado lateral

O portal publica `/conteudo/relatorio-orcamento-sensivel-ao-genero---osg` — Orçamento
Sensível ao Gênero, um dos temas da curadoria (`OSG`). Vale conferir se a metodologia bate
com a do sistema.

---

## 6. O que ainda não foi verificado

- Comparação em **exercício fechado**: o banco só tem importações de 2026, então a
  conferência de §1.5 é contra um exercício aberto e uma defasagem de 16 dias. Um QDD de
  2025 importado permitiria checar igualdade exata em vez de direção.
- Se o `functionalProgram` mantém o formato de 17 dígitos em QDDs de exercícios anteriores.
- Diferença no sentido inverso (API → QDD): apenas **1** par `(programa, órgão, unidade)` do
  portal não tem ação correspondente no QDD VIGENTE de 2026, com R$ 100.000 empenhados
  (`11333229280285604`, órgão 759). Irrelevante em volume, mas vale entender a causa antes
  de tratar a API como fonte de verdade para *descobrir* ações.

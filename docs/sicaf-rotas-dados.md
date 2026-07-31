# Rotas de dados: SICAF e Portal da Transparência (AC)

Levantamento de 2026-07-31. Reconhecimento apenas — nada foi importado nem executado
contra o banco.

## Resumo

| Fonte | Tem QDD/dotação? | Auth | Formato | Durabilidade |
|---|---|---|---|---|
| SICAF `app.quadrodetalhadodespesa` | **Sim** (é a fonte do QDD) | Sessão (cookie) | XLSX / PDF | Frágil (sessão + GeneXus) |
| Transparência `/despesas/listar` | Não | Pública | JSON (DataTables) | Boa |
| Transparência `/conteudo/despesas-por-orgao/listar` | Não | Pública | JSON | Boa |

**Nenhuma rota pública com dados de QDD foi encontrada.** As duas fontes são
complementares, não substitutas: o portal entrega execução, o SICAF entrega dotação.

## 1. SICAF — não há API REST

`https://sicaf.sefaz.ac.gov.br/sicaf/` é **GeneXus Java 17.0.11 + WorkWithPlus**.

- O framework traz o helper `WWP_getAjaxCallRestURL(n)` →
  `gx.basePath + "/rest/" + n.replace(".","/")` em `static/DVelop/Shared/WorkWithPlusCommon.js`.
- **Nenhum chamador** desse helper existe nos bundles carregados. É código morto do
  framework, não API exposta.
- Não há OData, Swagger nem serviço declarado no cliente.

Tudo é servlet de tela: `GET /sicaf/app.<objeto>`, com `MAINFORM` fazendo POST para a
própria URL.

### Objetos do módulo Execução Orçamentária

Leitura (seguros): `empenhoww`, `liquidacaoww`, `pagamentoww`, `arrecadacaoww`,
`credoresww`, `classesww`, `despesaextraww`, `quadrodetalhadodespesa`,
`wdespesapornatureza`, `wbalancetereceita`, `wreceitaarrecadada`, `extratocredor`,
`relatoriosexecucao`, `wrelatoriosderp`.

**Escrita — não tocar:** `empenhoanulacaoww`, `liquidacaoanulacaoww`,
`pagamentoanulacaoww`, `despesaextraanulacaoww`, `cadastrocredor`, `emitirdocumentos`,
`emissaodeetiquetas`.

### `app.quadrodetalhadodespesa` — a fonte do QDD

`GET https://sicaf.sefaz.ac.gov.br/sicaf/app.quadrodetalhadodespesa`

Tela parametrizada com exportação nativa para Excel (`BTNEXCEL`) e PDF (`BTNIMPRIMIR`).

**Tipos de relatório (`vTIPOREL`):**

| Valor | Relatório |
|---|---|
| 1 | Saldo Atual — Execução |
| 5 | Saldo Atual — Orçamento / Execução |
| 2 | **Saldo Retroativo — Execução** |
| 3 | Saldo Retroativo — Orçamento |
| 4 | **QDD — Execução Orçamentária por SubAção** |

**Demais parâmetros** (todos com par Inicial/Final `…I`/`…F`):

- `vCDGORGI/F` órgão · `vCDGUNII/F` unidade
- `vRDZFPPAI/F` reduzido · `vCDGSUBPAI/F` subprojeto/atividade
- `vFUNCPROGI/F` funcional programática
- `vCDGFNCDOTI/F` função · `vCDGSFNDOTI/F` subfunção
- `vCDGDSPRCTI/F` despesa (natureza) · `vCDGFNTORCI/F` fonte
- `vMES` 1–12 · `vATEMES` S/N (acumulado até o mês)
- `vGRAU` 1–8 (nível de detalhe da natureza) · `vTIPO` 0 = sintéticas+analíticas, 2 = só analíticas

**Mecanismo da exportação** — evento AJAX GeneXus, não uma rota GET limpa:

```
POST /sicaf/app.quadrodetalhadodespesa
  _EventName=DOEXCEL   (imprimir = DOIMPRIMIR, sair = DOSAIR)
  + GXState (JSON do estado completo do form)
  + gx.O.ajaxSecurityToken
```

O arquivo gerado volta como URL no corpo da resposta. Implicações:

- Exige cookie de sessão válido **e** o `GXState`/token daquela renderização — não dá
  para montar uma URL estável e agendar.
- `fullAjax = true`, `supportAjaxEvents = true`, token de segurança por requisição.
- Quebra a cada mudança de versão do GeneXus (o build aparece nos querystrings dos
  assets, ex.: `?2026731040278`).

Viável para automação assistida (sessão aberta), **não** para ingestão desacompanhada.

## 2. Portal da Transparência — público, mas sem QDD

`https://transparencia.ac.gov.br` (Laravel). Alimentado pelo mesmo SICAF, junto com
Turmalina, GRP e LICON. `/dados-abertos` retorna **404** — a seção anunciada não existe.

Endpoints reais, todos **POST** (GET responde 405), com `_token`/`X-CSRF-TOKEN` de meta
tag e protocolo DataTables server-side (`draw`, `start`, `length`, `columns[…]`):

### `POST /despesas/listar`

Filtros aceitos: `ano`, `orgao`, `busca`, `filtro`, `fonte`, `despesa`, `periodo`,
`inicio`, `fim`, `mes`, `bimestre`, `trimestre`, `quadrimestre`, `semestre`,
`nr_empenho`, `motivo`, `programa`.

Colunas retornadas: Ano · Órgão · Nome do Fornecedor · CNPJ/CPF · Classe fornecedor ·
Número do Empenho · Data do Empenho · Descrição do Elemento · Fonte · Descrição da
Função · Descrição da Subfunção · Histórico · Valor do Empenho · Valor Liquidado ·
Valor Pago.

Série histórica desde 1996. Há também `POST /despesas/valores` (agregados do gráfico) e
o padrão `…/dados-exportacao` para exportação em massa.

### `POST /conteudo/despesas-por-orgao/listar`

Só Órgão · Total Empenhado · Total Liquidado · Total Pago.

### Por que isso não substitui o QDD

O portal é **granularidade de empenho por fornecedor**. Falta exatamente o que o QDD tem:

- dotação inicial, dotação atualizada, créditos adicionais, saldo
- código de subação/ação — a base do `actionLogicalKey` em
  `apps/web/src/lib/qdd-parser.ts`
- reduzido, hierarquia de natureza por grau
- a visão "saldo retroativo"

Ou seja: serve para **execução** (empenhado/liquidado/pago) e para reconciliar valores,
mas a dotação continua vindo do SICAF.

## 3. Recomendação

1. **Dotação/QDD** — manter o SICAF, via `vTIPOREL=4` (ou `2` para saldo retroativo) →
   exportar Excel. Automação possível só com sessão ativa.
2. **Execução** — usar `POST /despesas/listar` do portal público. Sem credencial, sem
   expiração de sessão, série histórica longa. Melhor candidato para ingestão agendada.
3. **Via oficial** — o portal anuncia dados abertos mas `/dados-abertos` está 404.
   Vale pedir à CGE/AC (que coordena o portal) ou à SEFAZ o acesso documentado ao QDD.
   É o único caminho realmente durável e evita depender de sessão de usuário nominal.

## Pendente de verificação

Não foi disparada nenhuma exportação real (`DOEXCEL`) — isso baixaria arquivo e requer
autorização. Falta confirmar: layout exato das colunas do XLSX do `vTIPOREL=4` e se a
URL do arquivo gerado tem validade além da sessão.

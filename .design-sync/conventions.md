# Convenções: Orçamentos Temáticos do Acre

Sistema da SEPLAN/Acre (Next.js + shadcn/ui + Tailwind v4). Interface **só em pt-BR**,
sem emoji e sem texto genérico.

## Montagem

- Os componentes ficam em `window.OrcamentosTematicos` (ex.: `OrcamentosTematicos.Card`).
- Envolva a árvore em `<TooltipProvider>`, como o layout raiz do app faz. Sem ele,
  `Tooltip` (e o que o usa) lança erro. `<Toaster />` entra uma vez na raiz, se
  houver toast.
- **Gráficos**: o Recharts do sistema vem em `OrcamentosTematicos.Recharts`
  (`BarChart`, `Bar`, `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Cell`…).
  Monte dentro de `ChartContainer config={{ liquidado: { label: 'Liquidado', color: '#5f8f70' } }}`,
  com `ChartTooltip`/`ChartTooltipContent` e `ChartLegend`/`ChartLegendContent`.
  Não carregue outra cópia do Recharts, porque o `ChartContainer` perde o tamanho.
- O CSS é **Tailwind v4 pré-compilado**. Existem as classes que o app usa mais
  utilitários de layout: `flex`/`grid`, `grid-cols-1…12`, `gap-*`/`p-*`/`m-*` (0 a 16),
  `text-xs…4xl`, `font-medium|semibold|bold`, `w-full`, `max-w-sm…7xl`, prefixos
  `sm:`/`md:`/`lg:`/`xl:`. Valor arbitrário novo (`w-[31rem]`) não existe: use
  `style={{ width: '31rem' }}`.

## Tokens (classes)

| Papel | Classe |
|---|---|
| Superfície da marca (faixas, cabeçalhos, botão primário) | `bg-marca` + `text-marca-contraste`, hover `hover:bg-marca-hover` |
| Texto/borda verde sobre fundo claro | `text-marca-escura`, `border-marca-escura` |
| Neutros | `bg-background`, `text-foreground`, `bg-card`, `bg-muted`, `text-muted-foreground`, `bg-secondary` |
| Bordas | estruturais `border-black/70`, internas `border-black/20`; `border-border` é preto |
| Tabela | cabeçalho `bg-stone-50`, zebra `odd:bg-stone-50/60` |
| Erro | `text-destructive`, `Button variant="destructive"` |

Nunca `text-white` sobre `bg-marca`: use `text-marca-contraste`. Os tokens CSS
(`--marca`, `--marca-hover`, `--marca-escura`, `--marca-contraste`, `--chart-1…5`,
`--gauge-1…6`) estão no `:root` de `_ds_bundle.css`.

- **Séries de gráfico** (Recharts `fill`/`stroke`): `#5f8f70`, `#8fa873`, `#b8b477`,
  `#110f24`, `#c8c89f`. Não use a cor da marca nas séries.
- **Temas são dado, não cromo.** OCAD `#0e7490`, OSG `#9333ea`, CLIMATICO `#065f46`.
  Use `ThemeBadge theme="OCAD|OSG|CLIMATICO"`; para status de validação,
  `StatusBadge status="RASCUNHO|ENVIADO|DEVOLVIDO|APROVADO"`.

## Receitas

- Rótulo de seção/coluna: `text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground`.
- Números com `tabular-nums`; moeda `R$ 48.312.900,00`
  (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
- `Card` já nasce com cabeçalho verde (`CardHeader` = `bg-marca`). Para um cabeçalho
  claro, use `className="bg-card text-card-foreground"` no `CardHeader`.
- **Painel plano do módulo `/orcamento`**: `Card size="sm"` com
  `!gap-0 overflow-hidden rounded-none border-black/70 bg-white !py-0 shadow-none` e
  `CardHeader` com `!mt-0 !rounded-none border-b border-black/70 bg-marca px-3 py-2 text-marca-contraste`.
  Dentro de `<div className="orcamento-page-root"><main className="orcamento-main">`,
  botões, campos e selects ficam retos (raio 0), como na tela real. `/seplan` e
  `/secretaria` usam os componentes arredondados padrão.
- Estados vazios: `Empty` > `EmptyHeader` > `EmptyMedia` + `EmptyTitle` + `EmptyDescription`,
  com texto concreto ("Não há registros correspondentes aos filtros aplicados.").
  Carregamento: `Skeleton`.
- Ícones: `lucide-react`, `size-4`; em botões, `data-icon="inline-start"`.
- **Proibido**: gradiente, sombra, blur, cantos arredondados em painéis, cores fora
  desta tabela. O vermelho só aparece no "Limpar filtros" com filtro ativo.

## Onde está a verdade

`styles.css` importa `_ds_bundle.css` (Tailwind compilado com os tokens). Cada
componente tem `components/<grupo>/<Nome>/<Nome>.d.ts` (props) e `.prompt.md`
(uso e exemplos). Leia-os antes de compor.

## Exemplo

```tsx
const { Card, CardHeader, CardTitle, CardContent, StatusBadge, Button } = window.OrcamentosTematicos;

<Card size="sm" className="!gap-0 overflow-hidden rounded-none border-black/70 bg-white !py-0 shadow-none">
  <CardHeader className="!mt-0 !rounded-none border-b border-black/70 bg-marca px-3 py-2 text-marca-contraste">
    <CardTitle className="uppercase tracking-wide">Execução por fonte</CardTitle>
  </CardHeader>
  <CardContent className="grid grid-cols-3 gap-4 p-3">
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Liquidado</span>
      <span className="font-semibold tabular-nums">R$ 31.074.518,42</span>
    </div>
    <StatusBadge status="ENVIADO" />
    <Button variant="outline" size="sm">Ver detalhes</Button>
  </CardContent>
</Card>
```

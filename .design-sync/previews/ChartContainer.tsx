import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Recharts,
} from 'orcamentos-tematicos';

// O Recharts do bundle (mesma cópia que o ChartContainer usa), no namespace
// `Recharts` para não colidir com Tooltip/Label/Legend da UI.
const { Bar, BarChart, CartesianGrid, XAxis, YAxis } = Recharts;

const PANEL_CLASS = '!gap-0 overflow-hidden rounded-none border-black/70 bg-white !py-0 shadow-none';
const CHART_HEADER_CLASS = '!mt-0 !rounded-none border-b border-black/70 bg-marca px-3 py-2 text-marca-contraste';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function compactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

const bySecretariat = [
  { tick: 'Educação', label: 'Secretaria de Estado de Educação', liquidated: 401_118_207.55 },
  { tick: 'Saúde', label: 'Secretaria de Estado de Saúde', liquidated: 352_774_109.86 },
  { tick: 'Polícia Militar', label: 'Polícia Militar do Estado do Acre', liquidated: 149_882_301.09 },
  { tick: 'Infraestrutura', label: 'Secretaria de Estado de Infraestrutura', liquidated: 98_315_260.4 },
  { tick: 'Meio Ambiente', label: 'Secretaria de Estado de Meio Ambiente', liquidated: 17_402_366.91 },
  { tick: 'Mulher', label: 'Secretaria de Estado da Mulher', liquidated: 4_035_772.18 },
];

const liquidatedConfig = { liquidated: { label: 'Liquidado', color: '#5f8f70' } };

export const BarrasPorSecretaria = () => (
  <Card size="sm" className={`flex w-[44rem] flex-col ${PANEL_CLASS}`}>
    <CardHeader className={CHART_HEADER_CLASS}>
      <CardTitle className="font-semibold uppercase leading-snug tracking-wide">Liquidado por secretaria</CardTitle>
      <CardDescription className="text-xs">Exercício 2026 · acumulado até agosto</CardDescription>
    </CardHeader>
    <CardContent className="px-2 pb-2 pt-1">
      <ChartContainer config={liquidatedConfig} className="w-full aspect-auto" style={{ height: '220px' }}>
        <BarChart
          accessibilityLayer
          layout="vertical"
          data={bySecretariat}
          margin={{ top: 2, right: 24, left: 2, bottom: 2 }}
          barCategoryGap="16%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => compactMoney(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="tick"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <ChartTooltip content={<ChartTooltipContent formatter={(value) => money.format(Number(value))} />} />
          <Bar dataKey="liquidated" fill="#5f8f70" stroke="none" radius={0} />
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

const cycle = [
  { tick: 'Educação', paid: 389_905_112.4, liquidatedNotPaid: 11_213_095.15, committedNotLiquidated: 97_194_332.63, notCommitted: 114_167_459.82 },
  { tick: 'Saúde', paid: 340_120_554.02, liquidatedNotPaid: 12_653_555.84, committedNotLiquidated: 118_232_772.45, notCommitted: 77_913_417.69 },
  { tick: 'Infraestrutura', paid: 91_004_870.15, liquidatedNotPaid: 7_310_390.25, committedNotLiquidated: 92_126_758.37, notCommitted: 96_672_631.23 },
  { tick: 'Polícia Militar', paid: 147_210_980.33, liquidatedNotPaid: 2_671_320.76, committedNotLiquidated: 26_508_124.53, notCommitted: 45_317_574.38 },
];

const cycleConfig = {
  paid: { label: 'Pago', color: '#5f8f70' },
  liquidatedNotPaid: { label: 'Liquidado não pago', color: '#8fa873' },
  committedNotLiquidated: { label: 'Empenhado não liquidado', color: '#b8b477' },
  notCommitted: { label: 'Não empenhado', color: '#c8c89f' },
};

export const CicloEmpilhado = () => (
  <Card size="sm" className={`flex w-[44rem] flex-col ${PANEL_CLASS}`}>
    <CardHeader className={CHART_HEADER_CLASS}>
      <CardTitle className="font-semibold uppercase leading-snug tracking-wide">Ciclo da despesa</CardTitle>
      <CardDescription className="text-xs">Da dotação atualizada ao pagamento, por secretaria</CardDescription>
    </CardHeader>
    <CardContent className="px-2 pb-2 pt-1">
      <ChartContainer config={cycleConfig} className="w-full aspect-auto" style={{ height: '220px' }}>
        <BarChart
          accessibilityLayer
          layout="vertical"
          data={cycle}
          margin={{ top: 2, right: 24, left: 2, bottom: 2 }}
          barCategoryGap="16%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => compactMoney(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="tick"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">{name}</span>
                    <span className="font-mono font-medium tabular-nums">{money.format(Number(value))}</span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="paid" name={cycleConfig.paid.label} stackId="cycle" fill="#5f8f70" radius={0} />
          <Bar dataKey="liquidatedNotPaid" name={cycleConfig.liquidatedNotPaid.label} stackId="cycle" fill="#8fa873" radius={0} />
          <Bar dataKey="committedNotLiquidated" name={cycleConfig.committedNotLiquidated.label} stackId="cycle" fill="#b8b477" radius={0} />
          <Bar dataKey="notCommitted" name={cycleConfig.notCommitted.label} stackId="cycle" fill="#c8c89f" radius={0} />
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

export const ComTooltipAtivo = () => (
  <Card size="sm" className={`flex w-[44rem] flex-col ${PANEL_CLASS}`}>
    <CardHeader className={CHART_HEADER_CLASS}>
      <CardTitle className="font-semibold uppercase leading-snug tracking-wide">Liquidado por secretaria</CardTitle>
      <CardDescription className="text-xs">Passe o mouse sobre a barra para ver o valor exato</CardDescription>
    </CardHeader>
    <CardContent className="px-2 pb-2 pt-1">
      <ChartContainer config={liquidatedConfig} className="w-full aspect-auto" style={{ height: '220px' }}>
        <BarChart
          accessibilityLayer
          layout="vertical"
          data={bySecretariat}
          margin={{ top: 2, right: 24, left: 2, bottom: 2 }}
          barCategoryGap="16%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => compactMoney(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="tick"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <ChartTooltip
            active
            defaultIndex={2}
            content={
              <ChartTooltipContent
                formatter={(value) => money.format(Number(value))}
                labelFormatter={(_, payload) => (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ''}
              />
            }
          />
          <Bar dataKey="liquidated" fill="#5f8f70" stroke="none" radius={0} />
        </BarChart>
      </ChartContainer>
    </CardContent>
  </Card>
);

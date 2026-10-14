import {
  HoverTabsList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  themePillClasses,
  themeTabIdleClasses,
} from 'orcamentos-tematicos';
import { BarChart3Icon, TableIcon } from 'lucide-react';

export const Padrao = () => (
  <Tabs defaultValue="acumulado" className="w-[34rem]">
    <TabsList>
      <TabsTrigger value="acumulado">Acumulado anual</TabsTrigger>
      <TabsTrigger value="mensal">Mês isolado</TabsTrigger>
      <TabsTrigger value="comparativo">Comparativo 2025</TabsTrigger>
    </TabsList>
    <TabsContent value="acumulado" className="border border-black/20 bg-white p-4">
      Execução de janeiro a agosto de 2026: <span className="font-semibold tabular-nums">R$ 1.482.906.311,27</span>{' '}
      liquidados de <span className="font-semibold tabular-nums">R$ 2.317.540.000,00</span> de dotação atualizada.
    </TabsContent>
  </Tabs>
);

export const Linha = () => (
  <Tabs defaultValue="graficos" className="w-[34rem]">
    <TabsList variant="line">
      <TabsTrigger value="graficos">
        <BarChart3Icon />
        Gráficos
      </TabsTrigger>
      <TabsTrigger value="tabela">
        <TableIcon />
        Tabela
      </TabsTrigger>
      <TabsTrigger value="folha" disabled>
        Folha de pagamento
      </TabsTrigger>
    </TabsList>
    <TabsContent value="graficos" className="pt-2 text-muted-foreground">
      Seis gráficos por natureza da despesa, fonte e unidade executora.
    </TabsContent>
  </Tabs>
);

export const PilulaDeHover = () => (
  <Tabs value="exercises" className="w-fit">
    <HoverTabsList
      activeValue="exercises"
      items={[
        { value: 'base', content: 'Base vigente' },
        { value: 'exercises', content: 'Exercícios' },
        { value: 'executors', content: 'Atribuição de execução' },
        { value: 'users', content: 'Usuários' },
        { value: 'reconciliation', content: 'Conferência com QDD' },
      ]}
    />
  </Tabs>
);

const themes = [
  { theme: 'OCAD', label: 'OCAD', count: 214 },
  { theme: 'OSG', label: 'OSG', count: 87 },
  { theme: 'CLIMATICO', label: 'Climático', count: 132 },
] as const;

export const PorTema = () => (
  <Tabs value="OSG" className="w-fit">
    <HoverTabsList
      activeValue="OSG"
      className="w-fit"
      items={themes.map((entry) => ({
        value: entry.theme,
        className: 'gap-1.5',
        pillClassName: themePillClasses[entry.theme],
        idleClassName: themeTabIdleClasses[entry.theme],
        content: (
          <>
            {entry.label}
            <span className="rounded-full border border-current px-1.5 text-[11px] leading-4 tabular-nums opacity-80">
              {entry.count}
            </span>
          </>
        ),
      }))}
    />
  </Tabs>
);

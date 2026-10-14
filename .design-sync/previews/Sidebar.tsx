import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from 'orcamentos-tematicos';
import {
  BarChart3Icon,
  ClipboardCheckIcon,
  CoinsIcon,
  DatabaseIcon,
  FileBarChart2Icon,
  FolderCogIcon,
  GaugeIcon,
  LogOutIcon,
  PackageIcon,
  RefreshCwIcon,
} from 'lucide-react';

// Tons claros da trilha, exatamente como em /seplan.
const SIDEBAR_TONES =
  '[--sidebar:oklch(0.97_0.005_165)] [--sidebar-foreground:oklch(0.25_0.04_165)] [--sidebar-accent:oklch(0.90_0.02_165)] [--sidebar-accent-foreground:oklch(0.18_0.05_165)] [--sidebar-border:oklch(0.85_0.03_165)]';

const groups = [
  {
    label: 'Painel',
    items: [
      { id: 'overview', label: 'Visão geral', icon: GaugeIcon },
      { id: 'reports', label: 'Informações Gerais', icon: BarChart3Icon },
    ],
  },
  {
    label: 'Dados e curadoria',
    items: [
      { id: 'structure', label: 'Estrutura vigente', icon: DatabaseIcon, badge: 1284 },
      { id: 'curation', label: 'Curadoria temática', icon: FolderCogIcon, badge: 433 },
    ],
  },
  {
    label: 'Validação',
    items: [
      { id: 'entregas', label: 'Inserir Entregas', icon: PackageIcon, badge: 159 },
      { id: 'review', label: 'Acompanhamento e Revisão', icon: ClipboardCheckIcon, badge: 38 },
      { id: 'results', label: 'Resultados', icon: FileBarChart2Icon, badge: 112 },
    ],
  },
];

const ACTIVE = 'structure';

function Navegacao() {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton isActive={item.id === ACTIVE} tooltip={item.label}>
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge>{item.badge.toLocaleString('pt-BR')}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function Rodape() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Monitoramento da execução orçamentária">
          <CoinsIcon />
          <span>Execução orçamentária</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Atualizar">
          <RefreshCwIcon />
          <span>Atualizar dados</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Sair">
          <LogOutIcon />
          <span>Sair</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function Conteudo() {
  return (
    <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden">
      <header className="sticky top-0 z-30 shrink-0 border-b border-black bg-marca text-marca-contraste">
        <div className="flex h-16 w-full items-center gap-3 px-4">
          <SidebarTrigger
            size="icon-lg"
            className="size-10 shrink-0 text-marca-contraste hover:bg-primary-foreground/10 hover:text-marca-contraste [&_svg]:size-8"
          />
          <span className="truncate font-semibold uppercase tracking-widest" style={{ fontSize: '22px' }}>
            Orçamentos Temáticos
          </span>
        </div>
      </header>
      <div className="flex flex-col gap-4 p-6">
        <h1 className="font-heading text-xl font-bold tracking-tight">Estrutura vigente</h1>
        <p className="text-sm text-muted-foreground">
          Base única de QDD do exercício 2026 — acumulado de janeiro a agosto, atualizada pelo SICAF em 26/09/2026.
        </p>
        <dl className="grid grid-cols-3 border border-black/70 bg-white">
          {[
            { label: 'Órgãos', value: '38' },
            { label: 'Ações', value: '1.284' },
            { label: 'Linhas de despesa', value: '6.917' },
          ].map((kpi) => (
            <div key={kpi.label} className="min-w-0 border-r border-black/20 px-3 py-2.5 last:border-r-0">
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {kpi.label}
              </dt>
              <dd className="mt-1 text-base font-bold tabular-nums">{kpi.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SidebarInset>
  );
}

export const Aberta = () => (
  <SidebarProvider defaultOpen>
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="bg-sidebar-primary p-0 text-sidebar-primary-foreground">
        <div className="flex h-16 items-center justify-center px-4">
          <span className="truncate text-lg font-semibold leading-tight">Perfil de Administrador</span>
        </div>
      </SidebarHeader>
      <div className="mx-3 h-px shrink-0 bg-sidebar-border" aria-hidden="true" />
      <SidebarContent className={SIDEBAR_TONES}>
        <Navegacao />
      </SidebarContent>
      <div className="mx-3 h-px shrink-0 bg-sidebar-border" aria-hidden="true" />
      <SidebarFooter className={SIDEBAR_TONES}>
        <Rodape />
      </SidebarFooter>
    </Sidebar>
    <Conteudo />
  </SidebarProvider>
);

export const SoIcones = () => (
  <SidebarProvider defaultOpen={false}>
    <Sidebar collapsible="icon">
      <SidebarContent className={SIDEBAR_TONES}>
        <Navegacao />
      </SidebarContent>
      <SidebarFooter className={SIDEBAR_TONES}>
        <Rodape />
      </SidebarFooter>
    </Sidebar>
    <Conteudo />
  </SidebarProvider>
);

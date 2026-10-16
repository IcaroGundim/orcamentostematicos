import { SidebarMenu, SidebarMenuItem, SidebarMenuSkeleton } from 'orcamentos-tematicos';

// Estado de carregamento da navegação lateral: cada item vira um esqueleto
// (ícone + texto de largura aleatória entre 50% e 90%, definida pelo componente).
export const CarregandoNavegacao = () => (
  <div className="bg-sidebar text-sidebar-foreground p-2" style={{ width: '16rem' }}>
    <SidebarMenu>
      {Array.from({ length: 6 }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </div>
);

export const SemIcone = () => (
  <div className="border border-black/20 bg-white p-2" style={{ width: '16rem' }}>
    <SidebarMenu>
      {Array.from({ length: 4 }).map((_, index) => (
        <SidebarMenuItem key={index}>
          <SidebarMenuSkeleton />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </div>
);

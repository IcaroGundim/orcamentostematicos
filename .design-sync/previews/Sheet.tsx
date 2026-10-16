import {
  Badge,
  Button,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ThemeBadge,
} from 'orcamentos-tematicos';
import { FolderCogIcon } from 'lucide-react';

const kpis = [
  { label: 'Dotação atualizada', value: 'R$ 48.312.900,00' },
  { label: 'Empenhado', value: 'R$ 39.880.210,50' },
  { label: 'Liquidado', value: 'R$ 31.074.518,42' },
  { label: 'Execução', value: '64,3%' },
];

export const Aberto = () => (
  <Sheet open>
    <SheetContent side="right" onOpenAutoFocus={(event) => event.preventDefault()}>
      <SheetHeader className="border-b border-black/20">
        <SheetTitle>Manutenção da Rede Estadual de Ensino</SheetTitle>
        <SheetDescription>2045 | Secretaria de Estado de Educação</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <ThemeBadge theme="OCAD" />
          <Badge variant="outline">Exclusivo</Badge>
          <Badge variant="secondary">Em preenchimento</Badge>
        </div>
        <dl className="grid grid-cols-2 border border-black/70">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="min-w-0 border-b border-r border-black/20 px-3 py-2.5">
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {kpi.label}
              </dt>
              <dd className="mt-1 truncate text-base font-bold tabular-nums">{kpi.value}</dd>
            </div>
          ))}
        </dl>
        <Separator />
        <div className="flex flex-col gap-1">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Programa
          </span>
          <span>12.361.1010 — Educação Básica de Qualidade</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Unidade executora
          </span>
          <span>071001 — Secretaria de Estado de Educação</span>
        </div>
      </div>
      <SheetFooter className="border-t border-black/20">
        <Button>
          <FolderCogIcon data-icon="inline-start" />
          Abrir na curadoria
        </Button>
        <SheetClose asChild>
          <Button variant="outline">Fechar</Button>
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

export const Inferior = () => (
  <Sheet open>
    <SheetContent side="bottom" onOpenAutoFocus={(event) => event.preventDefault()}>
      <SheetHeader>
        <SheetTitle>Prévia do SICAF pronta (exercício 2026)</SheetTitle>
        <SheetDescription>
          Coleta automática · 1.284 ações, 38 órgãos · gerada em 29/09/2026 07:12. Não precisa exportar nem
          enviar o arquivo — revise e confirme.
        </SheetDescription>
      </SheetHeader>
      <SheetFooter className="flex-row justify-end">
        <SheetClose asChild>
          <Button variant="outline">Depois</Button>
        </SheetClose>
        <Button>Revisar prévia</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

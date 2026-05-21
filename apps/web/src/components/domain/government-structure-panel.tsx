'use client';

import { useMemo, useState } from 'react';
import { Building2Icon, ChevronDownIcon, DatabaseIcon, SearchIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { GovernmentEntityType, GovernmentStructure } from '@/types/domain';

const typeLabels: Record<GovernmentEntityType, string> = {
  SECRETARIA: 'Secretaria',
  AUTARQUIA: 'Autarquia',
  FUNDACAO: 'Fundação',
  EMPRESA_PUBLICA: 'Empresa pública',
  FUNDO: 'Fundo',
  OUTRO: 'Outro',
};

interface Props {
  structure: GovernmentStructure;
}

export function GovernmentStructurePanel({ structure }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const normalized = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return structure.organizations;
    return structure.organizations
      .map((org) => ({
        ...org,
        units: org.units.filter(
          (u) =>
            u.code.toLowerCase().includes(normalized) ||
            u.name.toLowerCase().includes(normalized),
        ),
      }))
      .filter(
        (org) =>
          org.code.toLowerCase().includes(normalized) ||
          org.name.toLowerCase().includes(normalized) ||
          org.units.length > 0,
      );
  }, [structure.organizations, normalized]);

  function toggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const totalUnits = structure.organizations.reduce((s, o) => s + o.units.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estrutura de governo</CardTitle>
        <CardDescription>
          Cadastro administrativo persistido ({structure.organizations.length} órgão
          {structure.organizations.length !== 1 ? 's' : ''}, {totalUnits} unidade
          {totalUnits !== 1 ? 's' : ''}). Atualize via conferência com QDD.
        </CardDescription>
        {structure.organizations.length > 0 ? (
          <div className="relative mt-2 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar órgão ou unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {structure.organizations.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <DatabaseIcon />
              </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>Cadastro vazio</EmptyTitle>
            <EmptyDescription>
              Importe um QDD e aplique as diferenças na aba Conferência com QDD para
              popular o cadastro de órgãos e unidades.
            </EmptyDescription>
          </Empty>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-2 pr-4">
              {filtered.map((org) => (
                <div key={org.code} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => toggle(org.code)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                        <p className="font-medium leading-snug">
                          {org.code} — {org.name}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[org.type]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {org.units.length} unidade{org.units.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronDownIcon
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        expanded.has(org.code) && 'rotate-180 text-primary',
                      )}
                    />
                  </button>
                  {expanded.has(org.code) ? (
                    <div className="border-t px-3 pb-3 pt-2">
                      <div className="flex flex-col gap-1.5">
                        {org.units.map((unit) => (
                          <div
                            key={unit.code}
                            className="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5"
                          >
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                              {unit.code}
                            </span>
                            <span className="truncate text-xs">{unit.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { CopyIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { GovernmentStructure } from '@/types/domain';

type Occurrence = {
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
  relocated: boolean;
};

type DuplicateGroup = {
  code: string;
  occurrences: Occurrence[];
};

interface Props {
  structure: GovernmentStructure;
  onChanged: () => void | Promise<void>;
}

function occurrenceKey(occ: Pick<Occurrence, 'organizationCode' | 'unitCode'>) {
  return `${occ.organizationCode}|${occ.unitCode}`;
}

/** Remove acentos e normaliza para comparação. */
function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** "Unidade gestora" é genérica (existe em todo órgão) e não conta como duplicidade. */
function isUnidadeGestora(unitName: string) {
  return normalizeName(unitName).includes('unidade gestora');
}

export function RelocatedUnitsPanel({ structure, onChanged }: Props) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const groups = useMemo<DuplicateGroup[]>(() => {
    const byCode = new Map<string, Occurrence[]>();
    for (const org of structure.organizations) {
      for (const unit of org.units) {
        if (isUnidadeGestora(unit.name)) continue;
        const list = byCode.get(unit.code) ?? [];
        list.push({
          organizationCode: org.code,
          organizationName: org.name,
          unitCode: unit.code,
          unitName: unit.name,
          relocated: unit.relocated,
        });
        byCode.set(unit.code, list);
      }
    }
    return [...byCode.entries()]
      .filter(([, occurrences]) => {
        const orgs = new Set(occurrences.map((o) => o.organizationCode));
        return orgs.size > 1;
      })
      .map(([code, occurrences]) => ({ code, occurrences }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [structure.organizations]);

  const normalized = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return groups;
    return groups.filter(
      (group) =>
        group.code.toLowerCase().includes(normalized) ||
        group.occurrences.some(
          (occ) =>
            occ.unitName.toLowerCase().includes(normalized) ||
            occ.organizationCode.toLowerCase().includes(normalized) ||
            occ.organizationName.toLowerCase().includes(normalized),
        ),
    );
  }, [groups, normalized]);

  const relocatedCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.occurrences.filter((o) => o.relocated).length, 0),
    [groups],
  );

  async function handleToggle(occ: Occurrence, relocated: boolean) {
    const key = occurrenceKey(occ);
    setSaving((prev) => new Set(prev).add(key));
    try {
      await api('/government-structure/unit-relocated', {
        method: 'PUT',
        body: JSON.stringify({
          organizationCode: occ.organizationCode,
          unitCode: occ.unitCode,
          relocated,
        }),
      });
      await onChanged();
      toast.success(relocated ? 'Unidade marcada como realocada.' : 'Marcação removida.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar a marcação.');
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unidades duplicadas</CardTitle>
        <CardDescription>
          Unidades cujo código aparece em mais de uma secretaria — geralmente remanejadas de órgão.
          Marque a ocorrência que foi realocada. {groups.length} código
          {groups.length !== 1 ? 's' : ''} em duplicidade
          {relocatedCount > 0 ? ` · ${relocatedCount} marcada${relocatedCount !== 1 ? 's' : ''}` : ''}.
        </CardDescription>
        {groups.length > 0 ? (
          <div className="relative mt-2 max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar código, unidade ou órgão..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <CopyIcon />
              </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>Nenhuma unidade duplicada</EmptyTitle>
            <EmptyDescription>
              Não há códigos de unidade aparecendo em mais de uma secretaria no cadastro atual.
            </EmptyDescription>
          </Empty>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="flex flex-col gap-3 pr-4">
              {filtered.map((group) => (
                <div key={group.code} className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {group.code}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {group.occurrences.length} ocorrências
                    </span>
                  </div>
                  <div className="flex flex-col divide-y">
                    {group.occurrences.map((occ) => {
                      const key = occurrenceKey(occ);
                      const isSaving = saving.has(key);
                      return (
                        <div
                          key={key}
                          role="button"
                          tabIndex={0}
                          aria-pressed={occ.relocated}
                          aria-label={`Marcar ${occ.unitName} (${occ.organizationName}) como realocada`}
                          onClick={() => {
                            if (!isSaving) handleToggle(occ, !occ.relocated);
                          }}
                          onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ' ') && !isSaving) {
                              event.preventDefault();
                              handleToggle(occ, !occ.relocated);
                            }
                          }}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors outline-none focus-visible:bg-muted/40',
                            occ.relocated ? 'bg-primary/5' : 'hover:bg-muted/40',
                            isSaving && 'pointer-events-none opacity-70',
                          )}
                        >
                          <Checkbox
                            className="pointer-events-none size-5"
                            checked={occ.relocated}
                            tabIndex={-1}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-snug">{occ.unitName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {occ.organizationCode} — {occ.organizationName}
                            </p>
                          </div>
                          {occ.relocated ? (
                            <Badge variant="secondary" className="shrink-0">
                              Realocada
                            </Badge>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

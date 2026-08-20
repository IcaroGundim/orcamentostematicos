'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Building2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import type { ExecutionStructure, UnitExecutionRow } from '@/types/domain';

interface Props {
  structure: ExecutionStructure;
  /** Exercício em que a atribuição será gravada — a rota o exige explicitamente. */
  year: number | null;
  onChanged: () => void | Promise<void>;
}

type Mode = 'parent' | 'self' | 'other';

function modeOf(unit: UnitExecutionRow): Mode {
  if (unit.executorUnitCode == null) return 'parent';
  if (unit.executorUnitCode === unit.unitCode) return 'self';
  return 'other';
}

export function ExecutionAssignmentCard({ structure, year, onChanged }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const normalized = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return structure.organizations;
    return structure.organizations
      .map((o) => ({
        ...o,
        units: o.units.filter(
          (u) =>
            u.unitCode.toLowerCase().includes(normalized) ||
            u.unitName.toLowerCase().includes(normalized),
        ),
      }))
      .filter(
        (o) =>
          o.code.toLowerCase().includes(normalized) ||
          o.name.toLowerCase().includes(normalized) ||
          o.units.length > 0,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atribuição de execução</CardTitle>
        <CardDescription>
          Configure quem executa cada unidade. Por padrão, cada unidade é executada pela própria
          secretaria. Para autarquias, fundações ou fundos administrados por outra unidade (ex.:
          FEM executando o Fundo Estadual de Cultura), atribua a unidade executora correta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          placeholder="Buscar por código ou nome (órgão ou unidade)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ScrollArea className="max-h-[60vh]">
          <ul className="flex flex-col gap-2 pr-2">
            {filtered.map((org) => {
              const isOpen = expanded.has(org.code);
              const autonomous = org.units.filter((u) => modeOf(u) === 'self');
              return (
                <li
                  key={org.code}
                  className="rounded-md border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => toggle(org.code)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDownIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    )}
                    <Building2Icon className="size-4 text-muted-foreground" />
                    <span className="font-mono text-xs text-muted-foreground">{org.code}</span>
                    <span className="flex-1 font-medium">{org.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {org.units.length} unidade{org.units.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="flex flex-col gap-1.5 border-t bg-muted/20 px-3 py-2">
                      {org.units.map((unit) => (
                        <UnitRow
                          key={`${unit.organizationCode}-${unit.unitCode}`}
                          unit={unit}
                          siblingsAsExecutors={autonomous}
                          year={year}
                          onChanged={onChanged}
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Unit row + executor picker ───────────────────────────────────────────────

function UnitRow({
  unit,
  siblingsAsExecutors,
  year,
  onChanged,
}: {
  unit: UnitExecutionRow;
  siblingsAsExecutors: UnitExecutionRow[];
  year: number | null;
  onChanged: () => void | Promise<void>;
}) {
  const currentMode = modeOf(unit);

  const label =
    currentMode === 'parent'
      ? 'Secretaria'
      : currentMode === 'self'
        ? 'Unidade autônoma (executa-se)'
        : `Executada por: ${unit.executorUnitCode}`;

  const otherExecutor =
    currentMode === 'other'
      ? siblingsAsExecutors.find((s) => s.unitCode === unit.executorUnitCode)
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-1.5">
      <span className="font-mono text-xs text-muted-foreground">{unit.unitCode}</span>
      <span className="flex-1 text-sm">{unit.unitName}</span>
      <Badge
        variant={currentMode === 'parent' ? 'outline' : 'default'}
        className="text-xs"
      >
        {currentMode === 'parent'
          ? label
          : currentMode === 'self'
            ? 'Autônoma'
            : `via ${otherExecutor?.unitName ?? unit.executorUnitCode}`}
      </Badge>
      <ExecutorPickerPopover
        unit={unit}
        siblingsAsExecutors={siblingsAsExecutors}
        year={year}
        onChanged={onChanged}
      />
    </div>
  );
}

function ExecutorPickerPopover({
  unit,
  siblingsAsExecutors,
  year,
  onChanged,
}: {
  unit: UnitExecutionRow;
  siblingsAsExecutors: UnitExecutionRow[];
  /** Exercício alvo da gravação — a rota o exige explicitamente. */
  year: number | null;
  onChanged: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(modeOf(unit));
  const [otherCode, setOtherCode] = useState<string>(
    modeOf(unit) === 'other' ? unit.executorUnitCode ?? '' : '',
  );
  const [saving, setSaving] = useState(false);

  function handleOpenChange(o: boolean) {
    if (o) {
      setMode(modeOf(unit));
      setOtherCode(modeOf(unit) === 'other' ? unit.executorUnitCode ?? '' : '');
    }
    setOpen(o);
  }

  const otherCandidates = siblingsAsExecutors.filter((s) => s.unitCode !== unit.unitCode);
  const canPickOther = otherCandidates.length > 0;

  async function handleSave() {
    let executorUnitCode: string | null;
    if (mode === 'parent') executorUnitCode = null;
    else if (mode === 'self') executorUnitCode = unit.unitCode;
    else {
      if (!otherCode) {
        toast.error('Selecione a unidade executora.');
        return;
      }
      executorUnitCode = otherCode;
    }

    setSaving(true);
    try {
      await api(`/execution/unit-executor${year == null ? '' : `?year=${year}`}`, {
        method: 'PUT',
        body: JSON.stringify({
          organizationCode: unit.organizationCode,
          unitCode: unit.unitCode,
          executorUnitCode,
        }),
      });
      toast.success(year == null ? 'Executor atualizado.' : `Executor atualizado no exercício ${year}.`);
      setOpen(false);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <PencilIcon data-icon="inline-start" />
          Alterar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]" align="end">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Quem executa esta unidade?</p>
            <p className="text-xs text-muted-foreground">
              {unit.unitCode} — {unit.unitName}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2">
              <input
                type="radio"
                className="mt-1"
                checked={mode === 'parent'}
                onChange={() => setMode('parent')}
              />
              <span className="flex flex-col text-sm">
                <span className="font-medium">Secretaria (padrão)</span>
                <span className="text-xs text-muted-foreground">
                  A própria secretaria {unit.organizationCode} executa esta unidade.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2">
              <input
                type="radio"
                className="mt-1"
                checked={mode === 'self'}
                onChange={() => setMode('self')}
              />
              <span className="flex flex-col text-sm">
                <span className="font-medium">Esta unidade é autônoma</span>
                <span className="text-xs text-muted-foreground">
                  Marque para autarquias, fundações ou empresas que executam o próprio orçamento e
                  podem executar outras unidades da mesma secretaria.
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2 ${canPickOther ? '' : 'opacity-50'}`}
            >
              <input
                type="radio"
                className="mt-1"
                checked={mode === 'other'}
                onChange={() => canPickOther && setMode('other')}
                disabled={!canPickOther}
              />
              <span className="flex flex-1 flex-col gap-1.5 text-sm">
                <span className="font-medium">Executada por outra unidade</span>
                {canPickOther ? (
                  <Select
                    value={otherCode}
                    onValueChange={(v) => {
                      setOtherCode(v);
                      setMode('other');
                    }}
                    disabled={mode !== 'other'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCandidates.map((c) => (
                        <SelectItem key={c.unitCode} value={c.unitCode}>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.unitCode}
                          </span>{' '}
                          {c.unitName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Nenhuma unidade autônoma na mesma secretaria ainda. Marque uma unidade como
                    autônoma primeiro.
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

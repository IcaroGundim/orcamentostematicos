'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { StructureDiff, StructureDiffApplySelection } from '@/types/domain';
import { FileSpreadsheetIcon } from 'lucide-react';

interface Props {
  diff: StructureDiff | null;
  source: 'preview' | 'vigente';
  previewId?: string;
  hasQddSource: boolean;
  onApplied: () => void | Promise<void>;
}

function diffIsEmpty(diff: StructureDiff): boolean {
  return (
    diff.newOrganizations.length === 0 &&
    diff.newUnits.length === 0 &&
    diff.missingOrganizations.length === 0 &&
    diff.missingUnits.length === 0 &&
    diff.renamedOrganizations.length === 0 &&
    diff.renamedUnits.length === 0
  );
}

export function QddStructureReconciliationPanel({
  diff,
  source,
  previewId,
  hasQddSource,
  onApplied,
}: Props) {
  const [selectedNewOrgs, setSelectedNewOrgs] = useState<Set<string>>(new Set());
  const [selectedNewUnits, setSelectedNewUnits] = useState<Set<string>>(new Set());
  const [selectedRenameOrgs, setSelectedRenameOrgs] = useState<Set<string>>(new Set());
  const [selectedRenameUnits, setSelectedRenameUnits] = useState<Set<string>>(new Set());
  const [selectedDeactivateOrgs, setSelectedDeactivateOrgs] = useState<Set<string>>(new Set());
  const [selectedDeactivateUnits, setSelectedDeactivateUnits] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const unitKey = (org: string, code: string) => `${org}|${code}`;

  const allNewOrgCodes = useMemo(
    () => diff?.newOrganizations.map((o) => o.code) ?? [],
    [diff],
  );
  const allNewUnitKeys = useMemo(
    () => diff?.newUnits.map((u) => unitKey(u.organizationCode, u.code)) ?? [],
    [diff],
  );

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllNew() {
    setSelectedNewOrgs(new Set(allNewOrgCodes));
    setSelectedNewUnits(new Set(allNewUnitKeys));
    setSelectedRenameOrgs(new Set(diff?.renamedOrganizations.map((o) => o.code) ?? []));
    setSelectedRenameUnits(
      new Set(diff?.renamedUnits.map((u) => unitKey(u.organizationCode, u.code)) ?? []),
    );
  }

  async function handleApply() {
    if (!diff || applying) return;

    const selection: StructureDiffApplySelection = {
      newOrganizationCodes: [...selectedNewOrgs],
      newUnits: [...selectedNewUnits].map((key) => {
        const [organizationCode, code] = key.split('|');
        return { organizationCode, code };
      }),
      renamedOrganizationCodes: [...selectedRenameOrgs],
      renamedUnits: [...selectedRenameUnits].map((key) => {
        const [organizationCode, code] = key.split('|');
        return { organizationCode, code };
      }),
      deactivateOrganizationCodes: [...selectedDeactivateOrgs],
      deactivateUnits: [...selectedDeactivateUnits].map((key) => {
        const [organizationCode, code] = key.split('|');
        return { organizationCode, code };
      }),
    };

    const hasSelection =
      (selection.newOrganizationCodes?.length ?? 0) > 0 ||
      (selection.newUnits?.length ?? 0) > 0 ||
      (selection.renamedOrganizationCodes?.length ?? 0) > 0 ||
      (selection.renamedUnits?.length ?? 0) > 0 ||
      (selection.deactivateOrganizationCodes?.length ?? 0) > 0 ||
      (selection.deactivateUnits?.length ?? 0) > 0;

    if (!hasSelection) {
      toast.error('Selecione ao menos um item para aplicar.');
      return;
    }

    setApplying(true);
    try {
      await api('/government-structure/apply', {
        method: 'POST',
        body: JSON.stringify({ source, previewId, selection }),
      });
      toast.success('Cadastro de estrutura atualizado.');
      setSelectedNewOrgs(new Set());
      setSelectedNewUnits(new Set());
      setSelectedRenameOrgs(new Set());
      setSelectedRenameUnits(new Set());
      setSelectedDeactivateOrgs(new Set());
      setSelectedDeactivateUnits(new Set());
      await onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aplicar diferenças.');
    } finally {
      setApplying(false);
    }
  }

  if (!hasQddSource) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conferência com QDD</CardTitle>
          <CardDescription>
            Compare o cadastro de estrutura com um arquivo QDD (prévia ou base vigente).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <FileSpreadsheetIcon />
              </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>Sem QDD para conferir</EmptyTitle>
            <EmptyDescription>
              Envie uma prévia na aba Base vigente ou importe um QDD vigente para ver as
              diferenças.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  if (!diff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conferência com QDD</CardTitle>
          <CardDescription>Carregando diferenças...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (diffIsEmpty(diff)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conferência com QDD</CardTitle>
          <CardDescription>
            Fonte: {source === 'preview' ? 'prévia do arquivo' : 'QDD vigente'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia>
                <CheckCircle2Icon />
              </EmptyMedia>
            </EmptyHeader>
            <EmptyTitle>Cadastro alinhado</EmptyTitle>
            <EmptyDescription>
              Não há diferenças entre o cadastro de estrutura e o QDD selecionado.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Conferência com QDD</CardTitle>
          <CardDescription>
            Revise e marque o que incorporar ao cadastro. Fonte:{' '}
            {source === 'preview' ? 'prévia' : 'vigente'}.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAllNew}>
            Selecionar novos e renomeações
          </Button>
          <Button type="button" size="sm" disabled={applying} onClick={() => void handleApply()}>
            {applying ? (
              <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <CheckCircle2Icon data-icon="inline-start" />
            )}
            {applying ? 'Aplicando...' : 'Aplicar ao cadastro'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <DiffSection
          title="Órgãos novos no QDD"
          empty="Nenhum órgão novo."
          rows={diff.newOrganizations.map((o) => (
            <TableRow key={o.code}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedNewOrgs.has(o.code)}
                  onChange={() => toggleSet(setSelectedNewOrgs, o.code)}
                  aria-label={`Incluir órgão ${o.code}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">{o.code}</TableCell>
              <TableCell>{o.name}</TableCell>
            </TableRow>
          ))}
        />

        <DiffSection
          title="Unidades novas no QDD"
          empty="Nenhuma unidade nova."
          rows={diff.newUnits.map((u) => (
            <TableRow key={unitKey(u.organizationCode, u.code)}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedNewUnits.has(unitKey(u.organizationCode, u.code))}
                  onChange={() =>
                    toggleSet(setSelectedNewUnits, unitKey(u.organizationCode, u.code))
                  }
                  aria-label={`Incluir unidade ${u.organizationCode}/${u.code}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {u.organizationCode} / {u.code}
              </TableCell>
              <TableCell>{u.name}</TableCell>
            </TableRow>
          ))}
        />

        <DiffSection
          title="Renomeações de órgãos"
          empty="Nenhuma renomeação de órgão."
          headers={['', 'Código', 'Cadastro', 'QDD']}
          rows={diff.renamedOrganizations.map((o) => (
            <TableRow key={o.code}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedRenameOrgs.has(o.code)}
                  onChange={() => toggleSet(setSelectedRenameOrgs, o.code)}
                  aria-label={`Aplicar renomeação ${o.code}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">{o.code}</TableCell>
              <TableCell>{o.catalogName}</TableCell>
              <TableCell>{o.qddName}</TableCell>
            </TableRow>
          ))}
        />

        <DiffSection
          title="Renomeações de unidades"
          empty="Nenhuma renomeação de unidade."
          headers={['', 'Par', 'Cadastro', 'QDD']}
          rows={diff.renamedUnits.map((u) => (
            <TableRow key={unitKey(u.organizationCode, u.code)}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedRenameUnits.has(unitKey(u.organizationCode, u.code))}
                  onChange={() =>
                    toggleSet(setSelectedRenameUnits, unitKey(u.organizationCode, u.code))
                  }
                  aria-label={`Aplicar renomeação ${u.organizationCode}/${u.code}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {u.organizationCode} / {u.code}
              </TableCell>
              <TableCell>{u.catalogName}</TableCell>
              <TableCell>{u.qddName}</TableCell>
            </TableRow>
          ))}
        />

        <DiffSection
          title="Órgãos no cadastro ausentes no QDD"
          empty="Nenhum órgão ausente no QDD."
          description="Marcar desativa o órgão no cadastro (não remove histórico)."
          rows={diff.missingOrganizations.map((o) => (
            <TableRow key={o.code}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedDeactivateOrgs.has(o.code)}
                  onChange={() => toggleSet(setSelectedDeactivateOrgs, o.code)}
                  aria-label={`Desativar órgão ${o.code}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">{o.code}</TableCell>
              <TableCell>{o.name}</TableCell>
            </TableRow>
          ))}
        />

        <DiffSection
          title="Unidades no cadastro ausentes no QDD"
          empty="Nenhuma unidade ausente no QDD."
          description="Marcar desativa a unidade no cadastro."
          rows={diff.missingUnits.map((u) => (
            <TableRow key={unitKey(u.organizationCode, u.code)}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedDeactivateUnits.has(unitKey(u.organizationCode, u.code))}
                  onChange={() =>
                    toggleSet(setSelectedDeactivateUnits, unitKey(u.organizationCode, u.code))
                  }
                  aria-label={`Desativar unidade ${u.organizationCode}/${u.code}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {u.organizationCode} / {u.code}
              </TableCell>
              <TableCell>{u.name}</TableCell>
            </TableRow>
          ))}
        />
      </CardContent>
    </Card>
  );
}

function DiffSection({
  title,
  description,
  empty,
  headers = ['', 'Código / par', 'Nome'],
  rows,
}: {
  title: string;
  description?: string;
  empty: string;
  headers?: string[];
  rows: React.ReactNode[];
}) {
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{empty}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <ScrollArea className="mt-2 max-h-48 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((h, i) => (
                <TableHead key={i} className={i === 0 ? 'w-10' : undefined}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{rows}</TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

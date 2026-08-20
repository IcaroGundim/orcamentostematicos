'use client';

import { useState } from 'react';
import { CheckCircle2Icon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Exercise } from '@/types/domain';

interface Props {
  exercises: Exercise[];
  onChanged: () => void | Promise<void>;
}

/**
 * Governança dos exercícios financeiros.
 *
 * Trocar o exercício corrente NÃO é navegação: as secretarias só escrevem no
 * corrente, então a troca derruba o acesso de escrita ao exercício anterior. Por
 * isso mora aqui, com confirmação, e não no seletor do cabeçalho.
 */
export function ExercisesPanel({ exercises, onChanged }: Props) {
  const [saving, setSaving] = useState<number | null>(null);

  async function patch(year: number, body: Record<string, unknown>, sucesso: string) {
    setSaving(year);
    try {
      await api(`/exercises/${year}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast.success(sucesso);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível alterar o exercício.');
    } finally {
      setSaving(null);
    }
  }

  function tornarCorrente(year: number) {
    const anterior = exercises.find((e) => e.isCurrent)?.year;
    const aviso =
      anterior == null
        ? `Tornar ${year} o exercício corrente?`
        : `Tornar ${year} o exercício corrente no lugar de ${anterior}?\n\n` +
          `As secretarias passam a preencher entregas em ${year}. As entregas de ${anterior} ` +
          `deixam de aceitar edição — o que já foi preenchido continua registrado.`;
    if (!window.confirm(aviso)) return;
    void patch(year, { isCurrent: true }, `Exercício ${year} agora é o corrente.`);
  }

  function alternarComparativo(exercise: Exercise) {
    const proximo = !exercise.comparisonOnly;
    void patch(
      exercise.year,
      { comparisonOnly: proximo },
      proximo
        ? `Exercício ${exercise.year} marcado como apenas comparativo.`
        : `Exercício ${exercise.year} deixou de ser apenas comparativo.`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exercícios financeiros</CardTitle>
        <CardDescription>
          O exercício corrente é o único em que as secretarias preenchem entregas. Exercícios
          comparativos recebem execução e marcações temáticas, mas não geram ciclos de
          validação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum exercício com QDD vigente. Importe um QDD na aba Base vigente.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercício</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercises.map((exercise) => (
                <TableRow key={exercise.year}>
                  <TableCell className="font-medium tabular-nums">{exercise.year}</TableCell>
                  <TableCell className="flex flex-wrap gap-2">
                    {exercise.isCurrent ? (
                      <Badge>
                        <CheckCircle2Icon data-icon="inline-start" />
                        Corrente
                      </Badge>
                    ) : null}
                    {exercise.comparisonOnly ? (
                      <Badge variant="secondary">Apenas comparativo</Badge>
                    ) : null}
                    {!exercise.isCurrent && !exercise.comparisonOnly ? (
                      <span className="text-xs text-muted-foreground">Exercício completo</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving != null || exercise.isCurrent || exercise.comparisonOnly}
                        title={
                          exercise.comparisonOnly
                            ? 'Exercício comparativo não pode ser o corrente.'
                            : undefined
                        }
                        onClick={() => tornarCorrente(exercise.year)}
                      >
                        {saving === exercise.year ? (
                          <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
                        ) : null}
                        Tornar corrente
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving != null || exercise.isCurrent}
                        title={
                          exercise.isCurrent
                            ? 'O exercício corrente não pode ser apenas comparativo.'
                            : undefined
                        }
                        onClick={() => alternarComparativo(exercise)}
                      >
                        {exercise.comparisonOnly ? 'Tornar completo' : 'Marcar comparativo'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

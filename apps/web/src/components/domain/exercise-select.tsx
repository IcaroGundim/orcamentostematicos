'use client';

import { CalendarRangeIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Exercise } from '@/types/domain';

interface ExerciseSelectProps {
  exercises: Exercise[];
  year: number | null;
  onChange: (year: number) => void;
  disabled?: boolean;
}

/**
 * Seletor de exercício financeiro do cabeçalho do app.
 *
 * Segue a receita de botão de cabeçalho da seção 4.3 do contrato de design
 * (`rounded-sm border-black/50 bg-white ... shadow-none`) para casar com os botões
 * vizinhos. Não usa `useHoverPill`: aquele contrato vale para abas/pílulas, e este
 * é um `Select`.
 *
 * Fica visível mesmo com um único exercício: quem opera precisa enxergar em qual
 * exercício está, não só poder trocá-lo. Escondê-lo deixou o sistema sem nenhuma
 * indicação de exercício enquanto só havia um.
 */
export function ExerciseSelect({ exercises, year, onChange, disabled }: ExerciseSelectProps) {
  if (exercises.length === 0) return null;

  return (
    <Select
      value={year == null ? undefined : String(year)}
      onValueChange={(value) => onChange(Number(value))}
      disabled={disabled || exercises.length < 2}
    >
      <SelectTrigger
        aria-label="Exercício financeiro"
        className="h-9 w-auto gap-2 rounded-sm border-black/50 bg-white text-foreground shadow-none hover:bg-stone-100 focus:ring-0 focus-visible:ring-0"
      >
        <CalendarRangeIcon className="size-4 shrink-0" aria-hidden />
        <SelectValue placeholder="Exercício" />
      </SelectTrigger>
      <SelectContent align="end">
        {exercises.map((exercise) => (
          <SelectItem key={exercise.year} value={String(exercise.year)}>
            <span className="tabular-nums">{exercise.year}</span>
            {exercise.comparisonOnly ? (
              <span className="ml-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Comparativo
              </span>
            ) : null}
            {exercise.isCurrent ? (
              <span className="ml-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Corrente
              </span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

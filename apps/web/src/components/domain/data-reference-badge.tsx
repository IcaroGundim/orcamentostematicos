import type { BudgetImport } from '@/types/domain';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Data (extenso) até quando os dados estão atualizados: último dia do mês anterior
 * ao de referência. Ex.: QDD inserido em junho → dados até "31 de maio".
 */
function formatUpdatedThrough(vigente: BudgetImport) {
  const through = new Date(vigente.year, vigente.referenceMonth - 1, 0);
  return `${through.getDate()} de ${(MONTH_NAMES[through.getMonth()] ?? '').toLowerCase()}`;
}

/**
 * Indicador retangular (verde escuro) com o exercício financeiro e a data até a
 * qual os dados da importação vigente se referem.
 */
export function DataReferenceBadge({ vigenteImport }: { vigenteImport?: BudgetImport | null }) {
  if (!vigenteImport) return null;
  return (
    <div className="flex items-center gap-3 rounded-md bg-green-900 px-3 py-1.5 text-white">
      <div className="flex flex-col leading-tight">
        <span className="text-[0.65rem] uppercase tracking-wide text-white/90">Exercício</span>
        <span className="text-sm font-semibold tabular-nums">{vigenteImport.year}</span>
      </div>
      <div className="h-7 w-px bg-white/25" />
      <div className="flex flex-col leading-tight">
        <span className="text-[0.65rem] uppercase tracking-wide text-white/90">Atualizado até</span>
        <span className="text-sm font-semibold tabular-nums">{formatUpdatedThrough(vigenteImport)}</span>
      </div>
    </div>
  );
}

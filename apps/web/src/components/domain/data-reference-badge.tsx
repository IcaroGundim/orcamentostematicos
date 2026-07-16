import type { BudgetImport } from '@/types/domain';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Data (extenso) até quando os dados estão atualizados: o dia em que o QDD foi
 * incluído combinado com o mês de referência da importação.
 * Ex.: QDD com referência em junho, incluído em 24/06 → "24 de junho".
 */
function formatUpdatedThrough(vigente: BudgetImport) {
  const day = new Date(vigente.importedAt).getDate();
  const month = (MONTH_NAMES[vigente.referenceMonth - 1] ?? '').toLowerCase();
  return `${day} de ${month}`;
}

/**
 * Indicador retangular (fundo branco, texto verde) com o exercício financeiro e
 * a data até a qual os dados da importação vigente se referem.
 */
export function DataReferenceBadge({ vigenteImport }: { vigenteImport?: BudgetImport | null }) {
  if (!vigenteImport) return null;
  return (
    <div className="flex items-center gap-3 rounded-md border border-green-900/20 bg-white px-3 py-1.5 text-green-900">
      <div className="flex flex-col leading-tight">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-green-900">Exercício</span>
        <span className="text-sm font-semibold tabular-nums">{vigenteImport.year}</span>
      </div>
      <div className="h-7 w-px bg-green-900/20" />
      <div className="flex flex-col leading-tight">
        <span className="text-[0.65rem] font-bold uppercase tracking-wide text-green-900">Atualizado até</span>
        <span className="text-sm font-semibold tabular-nums">{formatUpdatedThrough(vigenteImport)}</span>
      </div>
    </div>
  );
}

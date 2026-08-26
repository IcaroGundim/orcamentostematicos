import * as XLSX from 'xlsx';

import { executionRate } from '@/lib/execution-monitor';
import { getFonteLabel } from '@/lib/fontes-recursos';
import { downloadBlob, escapeCsvCell, todayStamp } from '@/lib/export-utils';
import type { BudgetAction } from '@/types/domain';

export type ExecutionExportFormat = 'xlsx' | 'csv' | 'json';

export type ExecutionExportRow = {
  orgaoCodigo: string;
  orgaoNome: string;
  unidadeCodigo: string;
  unidadeNome: string;
  acao: string;
  programaFuncional: string;
  projetoAtividade: string;
  fontesRecurso: string;
  orcamentoInicial: number;
  suplementado: number;
  orcamentoAtualizado: number;
  empenhado: number;
  liquidado: number;
  pago: number;
  disponivel: number;
  execucao: number;
  ano: number;
};

const COLUMN_ORDER: (keyof ExecutionExportRow)[] = [
  'orgaoCodigo',
  'orgaoNome',
  'unidadeCodigo',
  'unidadeNome',
  'acao',
  'programaFuncional',
  'projetoAtividade',
  'fontesRecurso',
  'orcamentoInicial',
  'suplementado',
  'orcamentoAtualizado',
  'empenhado',
  'liquidado',
  'pago',
  'disponivel',
  'execucao',
  'ano',
];

const HEADERS: Record<keyof ExecutionExportRow, string> = {
  orgaoCodigo: 'Código órgão',
  orgaoNome: 'Órgão',
  unidadeCodigo: 'Código unidade',
  unidadeNome: 'Unidade',
  acao: 'Ação',
  programaFuncional: 'Programa funcional',
  projetoAtividade: 'Projeto/Atividade',
  fontesRecurso: 'Fontes de recurso',
  orcamentoInicial: 'Dotação inicial',
  suplementado: 'Suplementado',
  orcamentoAtualizado: 'Dotação atualizada',
  empenhado: 'Empenhado',
  liquidado: 'Liquidado',
  pago: 'Pago',
  disponivel: 'Disponível',
  execucao: 'Execução (%)',
  ano: 'Ano',
};

/** Rótulos distintos de fonte da ação; códigos repetidos com rótulos iguais colapsam. */
function sourcesOf(action: BudgetAction): string {
  const labels = new Set<string>();
  for (const line of action.expenseLines ?? []) {
    const code = (line.source ?? '').trim();
    if (!code) continue;
    labels.add(getFonteLabel(code, action.year) ?? code);
  }
  return [...labels].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('; ');
}

/**
 * Uma linha por ação do recorte filtrado no painel (`filteredActions`), com os
 * mesmos estágios monetários exibidos nos KPIs e nas tabelas. A taxa de execução
 * reusa `executionRate` — nenhuma fórmula nova aqui.
 */
export function buildExecutionRows(actions: BudgetAction[]): ExecutionExportRow[] {
  return actions.map((action) => ({
    orgaoCodigo: action.organizationCode ?? '',
    orgaoNome: action.organizationName ?? '',
    unidadeCodigo: action.unitCode ?? '',
    unidadeNome: action.unitName ?? '',
    acao: action.application ?? '',
    programaFuncional: action.functionalProgram ?? '',
    projetoAtividade: action.projectActivity ?? '',
    fontesRecurso: sourcesOf(action),
    orcamentoInicial: action.totals.initialBudget,
    suplementado: action.totals.supplemented,
    orcamentoAtualizado: action.totals.updatedBudget,
    empenhado: action.totals.committed,
    liquidado: action.totals.liquidated,
    pago: action.totals.paid,
    disponivel: action.totals.available,
    execucao: executionRate(action.totals.liquidated, action.totals.updatedBudget),
    ano: action.year,
  }));
}

export function defaultExecutionFilename(year: number, ext: ExecutionExportFormat): string {
  return `execucao-orcamentaria-${year}-${todayStamp()}.${ext}`;
}

export function exportExecutionXlsx(rows: ExecutionExportRow[], filename: string): void {
  const workbook = XLSX.utils.book_new();
  const columns = COLUMN_ORDER.map((k) => HEADERS[k]);

  // Sheet única estruturada por órgão: cabeçalho geral e, na sequência, uma linha
  // de seção mesclada por órgão (ordem de código) com as ações dele abaixo.
  const byOrganization = new Map<string, ExecutionExportRow[]>();
  for (const row of rows) {
    const group = byOrganization.get(row.orgaoCodigo);
    if (group) group.push(row);
    else byOrganization.set(row.orgaoCodigo, [row]);
  }

  const aoa: (string | number | null)[][] = [columns];
  const merges: XLSX.Range[] = [];
  const lastColumn = columns.length - 1;

  for (const [code, orgRows] of [...byOrganization.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'pt-BR'),
  )) {
    const sectionRowIndex = aoa.length;
    const name = orgRows[0]?.orgaoNome ?? '';
    aoa.push([
      `${code} — ${name} (${orgRows.length.toLocaleString('pt-BR')} ação(ões))`,
    ]);
    for (const row of orgRows) {
      aoa.push(COLUMN_ORDER.map((k) => row[k]));
    }
    merges.push({
      s: { r: sectionRowIndex, c: 0 },
      e: { r: sectionRowIndex, c: lastColumn },
    });
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!merges'] = merges;
  sheet['!cols'] = columnWidths;

  // Formato numérico dos valores monetários e do percentual (células saem como
  // números reais, formatados na exibição pelo Excel).
  const moneyIndexes = COLUMN_ORDER.reduce<number[]>((acc, key, index) => {
    if (MONEY_KEYS.has(key)) acc.push(index);
    return acc;
  }, []);
  const rateIndex = COLUMN_ORDER.indexOf('execucao');
  for (let r = 1; r < aoa.length; r++) {
    for (const c of moneyIndexes) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = '#,##0.00';
    }
    const rateCell = sheet[XLSX.utils.encode_cell({ r, c: rateIndex })];
    if (rateCell && rateCell.t === 'n') rateCell.z = '0.0';
  }

  XLSX.utils.book_append_sheet(workbook, sheet, 'Execução');
  XLSX.writeFile(workbook, filename);
}

/** Chaves monetárias que recebem formato de moeda na sheet. */
const MONEY_KEYS = new Set<keyof ExecutionExportRow>([
  'orcamentoInicial',
  'suplementado',
  'orcamentoAtualizado',
  'empenhado',
  'liquidado',
  'pago',
  'disponivel',
]);

/** Larguras por coluna, suficientes para os rótulos e valores sem sobreposição. */
const columnWidths = COLUMN_ORDER.map((key) => {
  if (key === 'acao' || key === 'orgaoNome') return { wch: 46 };
  if (key === 'programaFuncional') return { wch: 34 };
  if (key === 'unidadeNome') return { wch: 30 };
  if (key === 'fontesRecurso') return { wch: 28 };
  if (MONEY_KEYS.has(key)) return { wch: 17 };
  return { wch: 14 };
});

export function exportExecutionCsv(rows: ExecutionExportRow[], filename: string): void {
  const separator = ';';
  const headerLine = COLUMN_ORDER.map((k) => escapeCsvCell(HEADERS[k])).join(separator);
  const bodyLines = rows.map((row) =>
    COLUMN_ORDER.map((k) => escapeCsvCell(row[k])).join(separator),
  );
  const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function exportExecutionJson(rows: ExecutionExportRow[], filename: string): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  downloadBlob(blob, filename);
}

export function exportExecution(
  rows: ExecutionExportRow[],
  format: ExecutionExportFormat,
  year: number,
): void {
  const filename = defaultExecutionFilename(year, format);
  if (format === 'xlsx') return exportExecutionXlsx(rows, filename);
  if (format === 'csv') return exportExecutionCsv(rows, filename);
  return exportExecutionJson(rows, filename);
}

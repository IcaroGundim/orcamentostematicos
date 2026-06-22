import * as XLSX from 'xlsx';

import { classificationLabels, themeLabels } from '@/lib/api';
import {
  resolveWeightingFactor,
  thematicBudgetContribution,
  usesDeliveryValues,
} from '@/lib/classification-rules';
import { downloadBlob, escapeCsvCell, todayStamp } from '@/lib/export-utils';
import type { BudgetAction, ThemeBudget } from '@/types/domain';

export type OverviewExportFormat = 'xlsx' | 'csv' | 'json';

export type OverviewExportRow = {
  tema: string;
  secretariaCodigo: string;
  secretariaNome: string;
  unidadeCodigo: string;
  unidadeNome: string;
  acaoCodigo: string;
  acao: string;
  programaFuncional: string;
  eixo: string;
  classificacao: string;
  ponderador: number | null;
  orcamentoInicial: number;
  orcamentoAtualizado: number;
  liquidado: number;
  disponivel: number;
  planejadoPonderado: number;
  liquidadoPonderado: number;
  ano: number;
  observacao: string;
};

const COLUMN_ORDER: (keyof OverviewExportRow)[] = [
  'tema',
  'secretariaCodigo',
  'secretariaNome',
  'unidadeCodigo',
  'unidadeNome',
  'acaoCodigo',
  'acao',
  'programaFuncional',
  'eixo',
  'classificacao',
  'ponderador',
  'orcamentoInicial',
  'orcamentoAtualizado',
  'liquidado',
  'disponivel',
  'planejadoPonderado',
  'liquidadoPonderado',
  'ano',
  'observacao',
];

const HEADERS: Record<keyof OverviewExportRow, string> = {
  tema: 'Tema',
  secretariaCodigo: 'Código secretaria',
  secretariaNome: 'Secretaria',
  unidadeCodigo: 'Código unidade',
  unidadeNome: 'Unidade',
  acaoCodigo: 'Código ação',
  acao: 'Ação',
  programaFuncional: 'Programa funcional',
  eixo: 'Eixo',
  classificacao: 'Classificação',
  ponderador: 'Ponderador',
  orcamentoInicial: 'Orçamento inicial',
  orcamentoAtualizado: 'Orçamento atualizado',
  liquidado: 'Liquidado',
  disponivel: 'Disponível',
  planejadoPonderado: 'Planejado ponderado',
  liquidadoPonderado: 'Liquidado ponderado',
  ano: 'Ano',
  observacao: 'Observação',
};

const DELIVERY_NOTE = 'Valor por entregas validadas (não disponível na Visão Geral)';

/**
 * Gera uma linha por (ação × tema atribuído), aplicando o ponderador aos valores
 * orçamentários. Apenas atribuições cujo tema está em `selectedThemes` entram.
 */
export function buildOverviewRows(
  actions: BudgetAction[],
  selectedThemes: Set<ThemeBudget>,
): OverviewExportRow[] {
  const rows: OverviewExportRow[] = [];
  for (const action of actions) {
    for (const a of action.assignments) {
      if (!selectedThemes.has(a.theme)) continue;

      const byDelivery = usesDeliveryValues(a.theme, a.classification);
      const { planned, liquidated } = thematicBudgetContribution({
        theme: a.theme,
        classification: a.classification,
        weightingFactor: a.weightingFactor,
        updatedBudget: action.totals.updatedBudget,
        liquidated: action.totals.liquidated,
      });

      rows.push({
        tema: themeLabels[a.theme] ?? a.theme,
        secretariaCodigo: action.organizationCode ?? '',
        secretariaNome: action.organizationName ?? '',
        unidadeCodigo: action.unitCode ?? '',
        unidadeNome: action.unitName ?? '',
        acaoCodigo: action.projectActivity ?? '',
        acao: action.application ?? '',
        programaFuncional: action.functionalProgram ?? '',
        eixo: a.axis ?? '',
        classificacao: classificationLabels[a.classification] ?? a.classification,
        ponderador: byDelivery
          ? null
          : resolveWeightingFactor(a.theme, a.classification, a.weightingFactor),
        orcamentoInicial: action.totals.initialBudget,
        orcamentoAtualizado: action.totals.updatedBudget,
        liquidado: action.totals.liquidated,
        disponivel: action.totals.updatedBudget - action.totals.liquidated,
        planejadoPonderado: planned,
        liquidadoPonderado: liquidated,
        ano: action.year,
        observacao: byDelivery ? DELIVERY_NOTE : '',
      });
    }
  }
  return rows;
}

export function defaultOverviewFilename(ext: OverviewExportFormat): string {
  return `orcamentos-tematicos-visao-geral-${todayStamp()}.${ext}`;
}

function toLabeledRecord(row: OverviewExportRow): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const key of COLUMN_ORDER) {
    out[HEADERS[key]] = row[key];
  }
  return out;
}

export function exportOverviewXlsx(
  rows: OverviewExportRow[],
  filename = defaultOverviewFilename('xlsx'),
): void {
  const workbook = XLSX.utils.book_new();
  const data = rows.map(toLabeledRecord);
  const sheet = XLSX.utils.json_to_sheet(data, {
    header: COLUMN_ORDER.map((k) => HEADERS[k]),
  });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Visão Geral');
  XLSX.writeFile(workbook, filename);
}

export function exportOverviewCsv(
  rows: OverviewExportRow[],
  filename = defaultOverviewFilename('csv'),
): void {
  const separator = ';';
  const headerLine = COLUMN_ORDER.map((k) => escapeCsvCell(HEADERS[k])).join(separator);
  const bodyLines = rows.map((row) =>
    COLUMN_ORDER.map((k) => escapeCsvCell(row[k])).join(separator),
  );
  const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function exportOverviewJson(
  rows: OverviewExportRow[],
  filename = defaultOverviewFilename('json'),
): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  downloadBlob(blob, filename);
}

export function exportOverview(
  rows: OverviewExportRow[],
  format: OverviewExportFormat,
): void {
  const filename = defaultOverviewFilename(format);
  if (format === 'xlsx') return exportOverviewXlsx(rows, filename);
  if (format === 'csv') return exportOverviewCsv(rows, filename);
  return exportOverviewJson(rows, filename);
}

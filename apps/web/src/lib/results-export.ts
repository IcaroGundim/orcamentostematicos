import * as XLSX from 'xlsx';
import { themeLabels } from '@/lib/api';
import { validationThematicTotals } from '@/lib/classification-rules';
import { downloadBlob, escapeCsvCell, todayStamp } from '@/lib/export-utils';
import type { ThemeBudget, ValidationItem } from '@/types/domain';

export type ResultsExportRow = {
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
  entregas: number;
  valorPlanejadoPonderado: number;
  valorLiquidadoTematico: number;
  valorExecutado: number;
  ciclo: string;
  ano: number;
};

export type ResultsThemeSummary = {
  theme: ThemeBudget;
  label: string;
  actionCount: number;
  orgCount: number;
  deliveriesCount: number;
  /** Liquidado temático: liquidado da ação × ponderador (mesma métrica do gauge). */
  liquidated: number;
  /** Planejado temático: dotação inicial × ponderador (categorias por entrega: executado das entregas). */
  planned: number;
  executed: number;
};

const HEADERS: Record<keyof ResultsExportRow, string> = {
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
  entregas: 'Entregas',
  valorPlanejadoPonderado: 'Planejado ponderado',
  valorLiquidadoTematico: 'Liquidado temático',
  valorExecutado: 'Valor executado informado',
  ciclo: 'Ciclo',
  ano: 'Ano',
};

const COLUMN_ORDER: (keyof ResultsExportRow)[] = [
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
  'entregas',
  'valorPlanejadoPonderado',
  'valorLiquidadoTematico',
  'valorExecutado',
  'ciclo',
  'ano',
];

export function buildResultsRows(validations: ValidationItem[]): ResultsExportRow[] {
  return validations.map((v) => {
    // Mesma metodologia do gauge de Informações Gerais (liquidado × ponderador),
    // para que os totais da exportação batam com a tela e entre si.
    const totals = validationThematicTotals({
      theme: v.theme,
      classification: v.assignment?.classification,
      weightingFactor: v.assignment?.weightingFactor,
      initialBudget: v.action?.totals?.initialBudget,
      liquidated: v.action?.totals?.liquidated,
      deliveries: v.deliveries,
    });
    return {
      tema: themeLabels[v.theme] ?? v.theme,
      secretariaCodigo: v.action?.organizationCode ?? v.organizationCode ?? '',
      secretariaNome: v.action?.organizationName ?? '',
      unidadeCodigo: v.action?.unitCode ?? v.unitCode ?? '',
      unidadeNome: v.action?.unitName ?? '',
      acaoCodigo: v.action?.projectActivity ?? '',
      acao: v.action?.application ?? '',
      programaFuncional: v.action?.functionalProgram ?? '',
      eixo: v.assignment?.axis ?? '',
      classificacao: v.assignment?.classification ?? '',
      ponderador:
        typeof v.assignment?.weightingFactor === 'number' ? v.assignment.weightingFactor : null,
      entregas: v.deliveries?.length ?? 0,
      valorPlanejadoPonderado: totals.planned,
      valorLiquidadoTematico: totals.liquidated,
      valorExecutado: v.informedExecutedValue ?? 0,
      ciclo: v.cycle?.name ?? '',
      ano: v.cycle?.year ?? v.action?.year ?? 0,
    };
  });
}

export function defaultExportFilename(ext: 'xlsx' | 'csv') {
  return `resultados-orcamentos-tematicos-${todayStamp()}.${ext}`;
}

function toLabeledRecord(row: ResultsExportRow): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const key of COLUMN_ORDER) {
    out[HEADERS[key]] = row[key] as string | number | null;
  }
  return out;
}

type FlatRow = Record<string, string | number | null>;

const FLAT_HEADERS = [
  'Tema',
  'Código secretaria',
  'Secretaria',
  'Código unidade',
  'Unidade',
  'Código ação',
  'Ação',
  'Programa funcional',
  'Eixo',
  'Classificação',
  'Ponderador',
  'Ciclo',
  'Ano',
  'Planejado ponderado',
  'Liquidado temático',
  'Valor executado da entrega',
  'Valor executado informado',
  'Total de entregas',
  'Entrega (nome)',
  'Descrição da entrega',
  'Quantidade',
  'Município',
  'Público beneficiado',
] as const;

export function buildFlatRows(validations: ValidationItem[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const v of validations) {
    const totals = validationThematicTotals({
      theme: v.theme,
      classification: v.assignment?.classification,
      weightingFactor: v.assignment?.weightingFactor,
      initialBudget: v.action?.totals?.initialBudget,
      liquidated: v.action?.totals?.liquidated,
      deliveries: v.deliveries,
    });
    // Os totais temáticos pertencem à validação, não a cada entrega. O arquivo tem uma
    // linha por entrega; repetir os totais nelas inflaria a soma das colunas no Excel
    // (uma validação com 7 entregas contaria 7×). Só a primeira linha da validação os
    // carrega — somando a coluna, o resultado reproduz exatamente os KPIs da tela.
    const validationTotals = {
      'Planejado ponderado': totals.planned,
      'Liquidado temático': totals.liquidated,
      'Valor executado informado': v.informedExecutedValue ?? 0,
      'Total de entregas': v.deliveries?.length ?? 0,
    };
    const blankTotals = {
      'Planejado ponderado': null,
      'Liquidado temático': null,
      'Valor executado informado': null,
      'Total de entregas': null,
    };
    const base: FlatRow = {
      Tema: themeLabels[v.theme] ?? v.theme,
      'Código secretaria': v.action?.organizationCode ?? v.organizationCode ?? '',
      Secretaria: v.action?.organizationName ?? '',
      'Código unidade': v.action?.unitCode ?? v.unitCode ?? '',
      Unidade: v.action?.unitName ?? '',
      'Código ação': v.action?.projectActivity ?? '',
      Ação: v.action?.application ?? '',
      'Programa funcional': v.action?.functionalProgram ?? '',
      Eixo: v.assignment?.axis ?? '',
      Classificação: v.assignment?.classification ?? '',
      Ponderador:
        typeof v.assignment?.weightingFactor === 'number' ? v.assignment.weightingFactor : null,
      Ciclo: v.cycle?.name ?? '',
      Ano: v.cycle?.year ?? v.action?.year ?? 0,
    };
    const deliveries = v.deliveries ?? [];
    if (deliveries.length === 0) {
      out.push({
        ...base,
        ...validationTotals,
        'Valor executado da entrega': null,
        'Entrega (nome)': '',
        'Descrição da entrega': '',
        Quantidade: null,
        Município: '',
        'Público beneficiado': '',
      });
    } else {
      deliveries.forEach((d, index) => {
        out.push({
          ...base,
          ...(index === 0 ? validationTotals : blankTotals),
          'Valor executado da entrega': typeof d.executedValue === 'number' ? d.executedValue : null,
          'Entrega (nome)': d.name?.trim() ?? '',
          'Descrição da entrega': d.description ?? '',
          Quantidade: d.quantity ?? 0,
          Município: d.municipality ?? '',
          'Público beneficiado': d.beneficiaries ?? '',
        });
      });
    }
  }
  return out;
}

export function exportResultsXlsx(
  validations: ValidationItem[],
  filename = defaultExportFilename('xlsx'),
): void {
  const workbook = XLSX.utils.book_new();
  const data = buildFlatRows(validations);
  const sheet = XLSX.utils.json_to_sheet(data, { header: [...FLAT_HEADERS] });
  XLSX.utils.book_append_sheet(workbook, sheet, 'Resultados');
  XLSX.writeFile(workbook, filename);
}

export function exportResultsCsv(
  rows: ResultsExportRow[],
  filename = defaultExportFilename('csv'),
): void {
  const separator = ';';
  const headerLine = COLUMN_ORDER.map((k) => escapeCsvCell(HEADERS[k])).join(separator);
  const bodyLines = rows.map((row) =>
    COLUMN_ORDER.map((k) => escapeCsvCell(row[k] as string | number | null)).join(separator),
  );
  const csv = '\ufeff' + [headerLine, ...bodyLines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

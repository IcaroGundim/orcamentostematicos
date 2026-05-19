import * as XLSX from 'xlsx';
import { themeLabels } from '@/lib/api';
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
  valorLiquidado: number;
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
  liquidated: number;
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
  valorLiquidado: 'Valor liquidado',
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
  'valorLiquidado',
  'valorExecutado',
  'ciclo',
  'ano',
];

export function buildResultsRows(validations: ValidationItem[]): ResultsExportRow[] {
  return validations.map((v) => ({
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
    valorLiquidado: v.action?.totals?.liquidated ?? 0,
    valorExecutado: v.informedExecutedValue ?? 0,
    ciclo: v.cycle?.name ?? '',
    ano: v.cycle?.year ?? v.action?.year ?? 0,
  }));
}

function todayStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  'Valor liquidado',
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
      'Valor liquidado': v.action?.totals?.liquidated ?? 0,
      'Valor executado informado': v.informedExecutedValue ?? 0,
      'Total de entregas': v.deliveries?.length ?? 0,
    };
    const deliveries = v.deliveries ?? [];
    if (deliveries.length === 0) {
      out.push({
        ...base,
        'Entrega (nome)': '',
        'Descrição da entrega': '',
        Quantidade: null,
        Município: '',
        'Público beneficiado': '',
      });
    } else {
      for (const d of deliveries) {
        out.push({
          ...base,
          'Entrega (nome)': d.name?.trim() ?? '',
          'Descrição da entrega': d.description ?? '',
          Quantidade: d.quantity ?? 0,
          Município: d.municipality ?? '',
          'Público beneficiado': d.beneficiaries ?? '',
        });
      }
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

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = typeof value === 'number' ? String(value) : String(value);
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

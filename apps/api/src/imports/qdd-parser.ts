import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { BudgetAction, BudgetImport, BudgetTotals, ExpenseLine, QddPeriodType } from '../common/domain';

export interface ParsedQdd {
  importRecord: BudgetImport;
  actions: BudgetAction[];
  sampleActions: BudgetAction[];
  organizationsCount: number;
  unitsCount: number;
}

export function parseQdd(
  filename: string,
  buffer: Buffer,
  createId: (prefix: string) => string,
  periodInfo: { periodType: QddPeriodType; referenceMonth: number },
): ParsedQdd {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  const headerIndex = rows.findIndex((row) => normalize(String(row[0])) === 'orgao' && normalize(String(row[1])) === 'unidade');
  if (headerIndex < 0) {
    throw new BadRequestException('Não foi possível localizar o cabeçalho do QDD.');
  }
  const headers = rows[headerIndex].map((header) => String(header).trim());
  const year = detectYear(rows, filename);
  const lines: ExpenseLine[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((cell) => String(cell ?? '').trim())) {
      continue;
    }
    const record: Record<string, unknown> = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
    const organization = splitCodeName(record['Orgao'] ?? record['Órgão']);
    const unit = splitCodeName(record['Unidade']);
    if (!organization.code || !unit.code) {
      continue;
    }
    lines.push({
      id: createId('line'),
      organizationCode: organization.code,
      organizationName: organization.name,
      unitCode: unit.code,
      unitName: unit.name,
      application: cleanText(record['Aplicação Programada']),
      functionalProgram: cleanText(record['Função Programática']).replace(/^'/, ''),
      projectActivity: cleanText(record['Projeto Atividade']),
      expenseAccount: cleanText(record['Conta de Despesa']),
      expenseDescription: cleanText(record['Descrição da Despesa']),
      reduced: cleanText(record['Reduzido Dotação']),
      source: cleanText(record['Fonte']),
      initialBudget: toNumber(record['Dotação Inicial ( A )']),
      supplemented: toNumber(record['Suplementado']),
      updatedBudget: toNumber(record['Ini+Sup+Cor-Red (B)']),
      committed: toNumber(record['Empenhado + Complementado ( C )']),
      liquidated: toNumber(record['Liquidado ( D )']),
      payableToLiquidate: toNumber(record['A Liquidar ( A+B-D )']),
      paid: toNumber(record['Pago ( E )']),
      payable: toNumber(record['A Pagar ( C-E )']),
      available: toNumber(record['Disponível (A-C)']),
    });
  }

  const actionMap = new Map<string, BudgetAction>();
  for (const line of lines) {
    const key = [year, line.organizationCode, line.unitCode, line.projectActivity, normalize(line.application)].join('|');
    const existing = actionMap.get(key);
    if (!existing) {
      actionMap.set(key, {
        id: createId('action'),
        year,
        organizationCode: line.organizationCode,
        organizationName: line.organizationName,
        unitCode: line.unitCode,
        unitName: line.unitName,
        application: line.application,
        functionalProgram: line.functionalProgram,
        projectActivity: line.projectActivity,
        totals: emptyTotals(),
        expenseLines: [line],
        assignmentIds: [],
      });
    } else {
      existing.expenseLines.push(line);
    }
  }

  const actions = [...actionMap.values()].map((action) => ({
    ...action,
    totals: action.expenseLines.reduce<BudgetTotals>(
      (total, line) => ({
        initialBudget: total.initialBudget + line.initialBudget,
        supplemented: total.supplemented + line.supplemented,
        updatedBudget: total.updatedBudget + line.updatedBudget,
        committed: total.committed + line.committed,
        liquidated: total.liquidated + line.liquidated,
        paid: total.paid + line.paid,
        available: total.available + line.available,
      }),
      emptyTotals(),
    ),
  }));

  const importRecord: BudgetImport = {
    id: createId('import'),
    filename,
    year,
    referenceMonth: periodInfo.referenceMonth,
    periodType: periodInfo.periodType,
    importedAt: new Date().toISOString(),
    rowCount: lines.length,
    actionCount: actions.length,
    status: 'VIGENTE',
  };

  return {
    importRecord,
    actions,
    sampleActions: actions.slice(0, 8).map((action) => ({ ...action, expenseLines: action.expenseLines.slice(0, 3) })),
    organizationsCount: new Set(actions.map((action) => action.organizationCode)).size,
    unitsCount: new Set(actions.map((action) => `${action.organizationCode}-${action.unitCode}`)).size,
  };
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function splitCodeName(value: unknown) {
  const text = cleanText(value);
  const match = text.match(/^(\d+)\s*(.*)$/);
  return {
    code: match?.[1] ?? '',
    name: match?.[2]?.trim() || text,
  };
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }
  const text = cleanText(value).replace(/\./g, '').replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyTotals(): BudgetTotals {
  return {
    initialBudget: 0,
    supplemented: 0,
    updatedBudget: 0,
    committed: 0,
    liquidated: 0,
    paid: 0,
    available: 0,
  };
}

function detectYear(rows: unknown[][], filename: string) {
  const joined = rows
    .slice(0, 5)
    .flat()
    .map((cell) => String(cell))
    .join(' ');
  const fromHeader = joined.match(/Exerc[ií]cio:\s*(\d{4})/i)?.[1];
  const fromFilename = filename.match(/20\d{2}/)?.[0];
  return Number(fromHeader ?? fromFilename ?? new Date().getFullYear());
}

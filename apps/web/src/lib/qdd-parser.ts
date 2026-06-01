import * as XLSX from 'xlsx';

export interface BudgetTotals {
  initialBudget: number; supplemented: number; updatedBudget: number;
  committed: number; liquidated: number; paid: number; available: number;
}

export interface ExpenseLine {
  id: string; organizationCode: string; organizationName: string;
  unitCode: string; unitName: string; application: string;
  functionalProgram: string; projectActivity: string;
  expenseAccount: string; expenseDescription: string;
  reduced: string; source: string;
  initialBudget: number; supplemented: number; updatedBudget: number;
  committed: number; liquidated: number; payableToLiquidate: number;
  paid: number; payable: number; available: number;
}

export interface BudgetAction {
  id: string; year: number; organizationCode: string; organizationName: string;
  unitCode: string; unitName: string; application: string;
  functionalProgram: string; projectActivity: string;
  totals: BudgetTotals; expenseLines: ExpenseLine[]; assignmentIds: string[];
}

export interface ParsedQdd {
  importRecord: { id: string; filename: string; year: number; referenceMonth: number; periodType: string; importedAt: string; rowCount: number; actionCount: number; status: string };
  actions: BudgetAction[];
  sampleActions: BudgetAction[];
  organizationsCount: number;
  unitsCount: number;
}

export function parseQdd(
  filename: string,
  buffer: Buffer,
  createId: (prefix: string) => string,
  periodInfo: { periodType: string; referenceMonth: number },
): ParsedQdd {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' });
  const headerIndex = rows.findIndex((row) => normalize(String((row as unknown[])[0])) === 'orgao' && normalize(String((row as unknown[])[1])) === 'unidade');
  if (headerIndex < 0) throw new Error('Não foi possível localizar o cabeçalho do QDD.');

  const headers = (rows[headerIndex] as unknown[]).map((h) => String(h).trim());
  const year = detectYear(rows, filename);
  const lines: ExpenseLine[] = [];

  for (const row of rows.slice(headerIndex + 1) as unknown[][]) {
    if (!row.some((cell) => String(cell ?? '').trim())) continue;
    const record: Record<string, unknown> = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    const organization = splitCodeName(record['Orgao'] ?? record['Órgão']);
    const unit = splitCodeName(record['Unidade']);
    if (!organization.code || !unit.code) continue;

    lines.push({
      id: createId('line'),
      organizationCode: organization.code, organizationName: organization.name,
      unitCode: unit.code, unitName: unit.name,
      application: cleanText(record['Aplicação Programada']),
      functionalProgram: cleanText(record['Função Programática']).replace(/^'/, ''),
      projectActivity: cleanText(record['Projeto Atividade']),
      expenseAccount: cleanText(record['Conta de Despesa']),
      expenseDescription: cleanText(record['Descrição da Despesa']),
      reduced: cleanText(record['Reduzido Dotação']), source: cleanText(record['Fonte']),
      initialBudget: toNumber(record['Dotação Inicial ( A )']),
      supplemented: toNumber(record['Suplementado']),
      updatedBudget: toNumber(record['Ini+Sup+Cor-Red (B)']),
      committed: toNumber(record['Empenhado + Complementado ( C )']),
      liquidated: toNumber(record['Liquidado ( D )']),
      payableToLiquidate: toNumber(record['A Liquidar ( A+B-D )']),
      paid: toNumber(record['Pago ( E )']),
      payable: toNumber(record['A Pagar ( C-E )']),
      available:
        toNumber(record['Ini+Sup+Cor-Red (B)']) -
        toNumber(record['Liquidado ( D )']),
    });
  }

  const actionMap = new Map<string, BudgetAction>();
  for (const line of lines) {
    const key = actionLogicalKey({ year, ...line });
    const existing = actionMap.get(key);
    if (!existing) {
      actionMap.set(key, {
        id: createId('action'), year, organizationCode: line.organizationCode, organizationName: line.organizationName,
        unitCode: line.unitCode, unitName: line.unitName, application: line.application,
        functionalProgram: line.functionalProgram, projectActivity: line.projectActivity,
        totals: emptyTotals(), expenseLines: [line], assignmentIds: [],
      });
    } else {
      existing.expenseLines.push(line);
    }
  }

  const actions = [...actionMap.values()].map((action) => ({
    ...action,
    totals: action.expenseLines.reduce<BudgetTotals>((t, l) => ({
      initialBudget: t.initialBudget + l.initialBudget, supplemented: t.supplemented + l.supplemented,
      updatedBudget: t.updatedBudget + l.updatedBudget, committed: t.committed + l.committed,
      liquidated: t.liquidated + l.liquidated, paid: t.paid + l.paid, available: t.available + l.available,
    }), emptyTotals()),
  }));

  const importRecord = {
    id: createId('import'), filename, year, referenceMonth: periodInfo.referenceMonth,
    periodType: periodInfo.periodType, importedAt: new Date().toISOString(),
    rowCount: lines.length, actionCount: actions.length, status: 'VIGENTE',
  };

  return {
    importRecord, actions,
    sampleActions: actions.slice(0, 8).map((a) => ({ ...a, expenseLines: a.expenseLines.slice(0, 3) })),
    organizationsCount: new Set(actions.map((a) => a.organizationCode)).size,
    unitsCount: new Set(actions.map((a) => `${a.organizationCode}-${a.unitCode}`)).size,
  };
}

function cleanText(value: unknown) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }

/**
 * Chave l\u00f3gica est\u00e1vel de uma a\u00e7\u00e3o or\u00e7ament\u00e1ria, id\u00eantica \u00e0 usada na agrega\u00e7\u00e3o
 * de linhas em `parseQdd`. Identifica a "mesma" a\u00e7\u00e3o entre vers\u00f5es de QDD mesmo
 * quando o `id` (aleat\u00f3rio) muda a cada importa\u00e7\u00e3o.
 */
export function actionLogicalKey(a: {
  year: number; organizationCode: string; unitCode: string;
  projectActivity: string; application: string;
}) {
  return [a.year, a.organizationCode, a.unitCode, a.projectActivity, normalize(a.application)].join('|');
}
function splitCodeName(value: unknown) {
  const text = cleanText(value);
  const match = text.match(/^(\d+)\s*(.*)$/);
  return { code: match?.[1] ?? '', name: match?.[2]?.trim() || text };
}
function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  const parsed = Number(cleanText(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
function emptyTotals(): BudgetTotals {
  return { initialBudget: 0, supplemented: 0, updatedBudget: 0, committed: 0, liquidated: 0, paid: 0, available: 0 };
}
function detectYear(rows: unknown[][], filename: string) {
  const joined = rows.slice(0, 5).flat().map((c) => String(c)).join(' ');
  const fromHeader = joined.match(/Exerc[ií]cio:\s*(\d{4})/i)?.[1];
  const fromFilename = filename.match(/20\d{2}/)?.[0];
  return Number(fromHeader ?? fromFilename ?? new Date().getFullYear());
}

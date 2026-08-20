import 'server-only';

import { prisma } from './prisma';
import { actionLogicalKey } from './qdd-parser';
import { getCurrentYear, getVigenteImportId } from './store';
import type {
  GovernmentEntityType,
  GovernmentStructure,
  StructureDiff,
  StructureDiffApplySelection,
} from '@/types/domain';

export type StructurePair = {
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
};

type ActionLike = {
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
};

/**
 * Cadastro de órgãos/unidades DO EXERCÍCIO. Sem `year`, o exercício corrente.
 *
 * A estrutura é por exercício porque `active` significa "presente no QDD daquele
 * ano" — num cadastro único, dois exercícios disputariam o mesmo campo.
 */
export async function listGovernmentStructure(year?: number | null): Promise<GovernmentStructure> {
  const targetYear = year ?? (await getCurrentYear());
  if (targetYear == null) return { organizations: [] };

  const rows = await prisma.exerciseOrganization.findMany({
    where: { year: targetYear, active: true },
    include: { units: { where: { active: true }, orderBy: { code: 'asc' } } },
    orderBy: { code: 'asc' },
  });

  return {
    organizations: rows.map((org) => ({
      code: org.code,
      name: org.name,
      type: org.type as GovernmentEntityType,
      active: org.active,
      units: org.units.map((unit) => ({
        code: unit.code,
        name: unit.name,
        active: unit.active,
        relocated: unit.relocated,
      })),
    })),
  };
}

export function extractPairsFromActions(actions: ActionLike[]): StructurePair[] {
  const orgNames = new Map<string, string>();
  const unitNames = new Map<string, string>();
  const pairs = new Map<string, StructurePair>();

  for (const action of actions) {
    orgNames.set(action.organizationCode, action.organizationName);
    unitNames.set(`${action.organizationCode}|${action.unitCode}`, action.unitName);
    const key = `${action.organizationCode}|${action.unitCode}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        organizationCode: action.organizationCode,
        organizationName: action.organizationName,
        unitCode: action.unitCode,
        unitName: action.unitName,
      });
    }
  }

  return [...pairs.values()].map((pair) => ({
    ...pair,
    organizationName: orgNames.get(pair.organizationCode) ?? pair.organizationName,
    unitName: unitNames.get(`${pair.organizationCode}|${pair.unitCode}`) ?? pair.unitName,
  }));
}

/**
 * Compara o QDD com o cadastro. Puro: o exercício e o estado de primeira
 * importação são acrescentados por quem carregou o contexto.
 */
export function diffGovernmentStructure(
  qddPairs: StructurePair[],
  catalog: GovernmentStructure,
): Omit<StructureDiff, 'year' | 'catalogEmpty'> {
  const orgByCode = new Map(catalog.organizations.map((o) => [o.code, o]));
  const unitByKey = new Map(
    catalog.organizations.flatMap((o) =>
      o.units.map((u) => [`${o.code}|${u.code}`, { org: o, unit: u }] as const),
    ),
  );

  const qddOrgCodes = new Set<string>();
  const qddUnitKeys = new Set<string>();

  const newOrganizations: StructureDiff['newOrganizations'] = [];
  const newUnits: StructureDiff['newUnits'] = [];
  const renamedOrganizations: StructureDiff['renamedOrganizations'] = [];
  const renamedUnits: StructureDiff['renamedUnits'] = [];

  for (const pair of qddPairs) {
    qddOrgCodes.add(pair.organizationCode);
    qddUnitKeys.add(`${pair.organizationCode}|${pair.unitCode}`);

    const catalogOrg = orgByCode.get(pair.organizationCode);
    if (!catalogOrg) {
      if (!newOrganizations.some((o) => o.code === pair.organizationCode)) {
        newOrganizations.push({ code: pair.organizationCode, name: pair.organizationName });
      }
    } else if (catalogOrg.name !== pair.organizationName) {
      if (!renamedOrganizations.some((o) => o.code === pair.organizationCode)) {
        renamedOrganizations.push({
          code: pair.organizationCode,
          catalogName: catalogOrg.name,
          qddName: pair.organizationName,
        });
      }
    }

    const catalogUnit = unitByKey.get(`${pair.organizationCode}|${pair.unitCode}`);
    if (!catalogUnit) {
      if (!newUnits.some((u) => u.organizationCode === pair.organizationCode && u.code === pair.unitCode)) {
        newUnits.push({
          organizationCode: pair.organizationCode,
          organizationName: pair.organizationName,
          code: pair.unitCode,
          name: pair.unitName,
        });
      }
    } else if (catalogUnit.unit.name !== pair.unitName) {
      if (
        !renamedUnits.some(
          (u) => u.organizationCode === pair.organizationCode && u.code === pair.unitCode,
        )
      ) {
        renamedUnits.push({
          organizationCode: pair.organizationCode,
          code: pair.unitCode,
          catalogName: catalogUnit.unit.name,
          qddName: pair.unitName,
        });
      }
    }
  }

  const missingOrganizations: StructureDiff['missingOrganizations'] = [];
  const missingUnits: StructureDiff['missingUnits'] = [];

  for (const org of catalog.organizations) {
    if (!qddOrgCodes.has(org.code)) {
      missingOrganizations.push({ code: org.code, name: org.name, type: org.type });
    }
    for (const unit of org.units) {
      if (!qddUnitKeys.has(`${org.code}|${unit.code}`)) {
        missingUnits.push({
          organizationCode: org.code,
          organizationName: org.name,
          code: unit.code,
          name: unit.name,
        });
      }
    }
  }

  return {
    newOrganizations: newOrganizations.sort((a, b) => a.code.localeCompare(b.code)),
    newUnits: newUnits.sort((a, b) =>
      `${a.organizationCode}-${a.code}`.localeCompare(`${b.organizationCode}-${b.code}`),
    ),
    missingOrganizations: missingOrganizations.sort((a, b) => a.code.localeCompare(b.code)),
    missingUnits: missingUnits.sort((a, b) =>
      `${a.organizationCode}-${a.code}`.localeCompare(`${b.organizationCode}-${b.code}`),
    ),
    renamedOrganizations: renamedOrganizations.sort((a, b) => a.code.localeCompare(b.code)),
    renamedUnits: renamedUnits.sort((a, b) =>
      `${a.organizationCode}-${a.code}`.localeCompare(`${b.organizationCode}-${b.code}`),
    ),
  };
}

export async function applyStructureDiff(
  diff: StructureDiff,
  qddPairs: StructurePair[],
  selection: StructureDiffApplySelection,
  year: number,
): Promise<void> {
  // Transação: sem ela, uma falha no meio deixa o cadastro do exercício meio
  // aplicado — parte renomeada, parte não —, e não há como saber onde parou.
  await prisma.$transaction(
    async (tx) => {
      const pairByOrg = new Map(qddPairs.map((p) => [p.organizationCode, p]));
      const pairByUnit = new Map(qddPairs.map((p) => [`${p.organizationCode}|${p.unitCode}`, p]));

      const newOrgCodes = new Set(selection.newOrganizationCodes ?? []);
      for (const org of diff.newOrganizations) {
        if (!newOrgCodes.has(org.code)) continue;
        const pair = pairByOrg.get(org.code);
        await tx.exerciseOrganization.upsert({
          where: { year_code: { year, code: org.code } },
          update: { name: org.name, active: true },
          create: {
            year,
            code: org.code,
            name: org.name,
            type: 'SECRETARIA',
            active: true,
          },
        });
        if (pair) pairByOrg.set(org.code, pair);
      }

      const newUnitKeys = new Set(
        (selection.newUnits ?? []).map((u) => `${u.organizationCode}|${u.code}`),
      );
      for (const unit of diff.newUnits) {
        const key = `${unit.organizationCode}|${unit.code}`;
        if (!newUnitKeys.has(key)) continue;
        const pair = pairByUnit.get(key);
        const orgName = pair?.organizationName ?? unit.organizationName;
        await tx.exerciseOrganization.upsert({
          where: { year_code: { year, code: unit.organizationCode } },
          update: {},
          create: {
            year,
            code: unit.organizationCode,
            name: orgName,
            type: 'SECRETARIA',
            active: true,
          },
        });
        await tx.exerciseUnit.upsert({
          where: { year_organizationCode_code: { year, organizationCode: unit.organizationCode, code: unit.code } },
          update: { name: unit.name, active: true },
          create: {
            year,
            organizationCode: unit.organizationCode,
            code: unit.code,
            name: unit.name,
            active: true,
          },
        });
      }

      const renameOrgCodes = new Set(selection.renamedOrganizationCodes ?? []);
      for (const org of diff.renamedOrganizations) {
        if (!renameOrgCodes.has(org.code)) continue;
        await tx.exerciseOrganization.update({
          where: { year_code: { year, code: org.code } },
          data: { name: org.qddName },
        });
      }

      const renameUnitKeys = new Set(
        (selection.renamedUnits ?? []).map((u) => `${u.organizationCode}|${u.code}`),
      );
      for (const unit of diff.renamedUnits) {
        const key = `${unit.organizationCode}|${unit.code}`;
        if (!renameUnitKeys.has(key)) continue;
        await tx.exerciseUnit.update({
          where: { year_organizationCode_code: { year, organizationCode: unit.organizationCode, code: unit.code } },
          data: { name: unit.qddName },
        });
      }

      const deactivateOrgCodes = new Set(selection.deactivateOrganizationCodes ?? []);
      for (const org of diff.missingOrganizations) {
        if (!deactivateOrgCodes.has(org.code)) continue;
        await tx.exerciseOrganization.update({
          where: { year_code: { year, code: org.code } },
          data: { active: false },
        });
      }

      const deactivateUnitKeys = new Set(
        (selection.deactivateUnits ?? []).map((u) => `${u.organizationCode}|${u.code}`),
      );
      for (const unit of diff.missingUnits) {
        const key = `${unit.organizationCode}|${unit.code}`;
        if (!deactivateUnitKeys.has(key)) continue;
        await tx.exerciseUnit.update({
          where: { year_organizationCode_code: { year, organizationCode: unit.organizationCode, code: unit.code } },
          data: { active: false },
        });
      }
    },
    { maxWait: 10000, timeout: 60000 },
  );
}

/**
 * Sincroniza o cadastro DO EXERCÍCIO a partir das ações do QDD importado. Como
 * cada exercício tem a sua própria estrutura, importar um ano nunca renomeia nem
 * reativa órgãos/unidades de outro.
 */
export async function syncStructureFromImport(actions: ActionLike[], year: number): Promise<void> {
  const pairs = extractPairsFromActions(actions);
  const orgNames = new Map<string, string>();

  for (const pair of pairs) {
    orgNames.set(pair.organizationCode, pair.organizationName);
  }

  for (const [code, name] of orgNames) {
    await prisma.exerciseOrganization.upsert({
      where: { year_code: { year, code } },
      update: { name },
      create: { year, code, name, type: 'SECRETARIA', active: true },
    });
  }

  for (const pair of pairs) {
    await prisma.exerciseUnit.upsert({
      where: {
        year_organizationCode_code: { year, organizationCode: pair.organizationCode, code: pair.unitCode },
      },
      update: { name: pair.unitName, active: true },
      create: {
        year,
        organizationCode: pair.organizationCode,
        code: pair.unitCode,
        name: pair.unitName,
        active: true,
      },
    });
  }
}

/**
 * Contexto de uma conferência: o exercício em jogo e o QDD que está sendo
 * comparado, lidos UMA única vez.
 *
 * Existe para eliminar a origem do bug em que uma prévia de um exercício era
 * comparada com o cadastro e as marcações de outro: aqui o exercício é derivado da
 * própria prévia, e o parâmetro de contexto (`?year=`) é **ignorado** nesse caso.
 * É a mesma origem que o `confirm` usa (`importRecord.year`), então o que a
 * conferência mostra é exatamente o que a confirmação fará.
 */
export type DiffContext = {
  year: number | null;
  pairs: StructurePair[];
  actions: ActionKeyFields[];
};

/** Payload da prévia, na forma mínima de que a conferência precisa. */
type PreviewPayload = {
  importRecord?: { year?: unknown };
  actions?: ActionKeyFields[];
};

async function loadPreviewPayload(previewId: string): Promise<PreviewPayload> {
  const preview = await prisma.importPreview.findUnique({ where: { id: previewId } });
  if (!preview) throw new Error('Prévia não encontrada.');
  const parsed = preview.data as PreviewPayload | null;
  if (!parsed || typeof parsed !== 'object') throw new Error('Prévia inválida.');
  return parsed;
}

export async function loadDiffContext(
  source: 'preview' | 'vigente',
  previewId?: string,
  year?: number | null,
): Promise<DiffContext> {
  if (source === 'preview') {
    if (!previewId) throw new Error('previewId é obrigatório para source=preview.');
    const parsed = await loadPreviewPayload(previewId);
    const previewYear = Number(parsed.importRecord?.year);
    if (!Number.isInteger(previewYear)) throw new Error('Exercício da prévia inválido.');
    const actions = parsed.actions ?? [];
    return { year: previewYear, pairs: extractPairsFromActions(actions), actions };
  }

  const targetYear = year ?? (await getCurrentYear());
  const vigenteId = await getVigenteImportId(targetYear);
  if (!vigenteId) return { year: targetYear, pairs: [], actions: [] };

  // Uma consulta só serve às duas leituras: os pares saem das mesmas ações.
  const actions = await prisma.budgetAction.findMany({
    where: { importId: vigenteId },
    select: {
      year: true, organizationCode: true, organizationName: true,
      unitCode: true, unitName: true, projectActivity: true, application: true,
    },
  });
  return { year: targetYear, pairs: extractPairsFromActions(actions), actions };
}

type ActionKeyFields = {
  year: number;
  organizationCode: string;
  organizationName: string;
  unitCode: string;
  unitName: string;
  projectActivity: string;
  application: string;
};

/**
 * Projeta as marcações temáticas atuais sobre o QDD em conferência: agrupa por
 * ação (chave lógica) e separa entre as que têm correspondência (serão mantidas)
 * e as que ficariam sem par.
 */
export async function buildMarkersProjection(
  context: DiffContext,
): Promise<NonNullable<StructureDiff['markers']>> {
  // O recorte por exercício é indispensável: sem ele, conferir uma prévia de um ano
  // listaria as marcações de todos os outros como "sem par" — `actionLogicalKey`
  // começa pelo ano e jamais casaria. O ano vem do contexto, que para prévias é o
  // da própria prévia.
  const { year: targetYear, actions: qddActions } = context;
  const [assignments] = await Promise.all([
    prisma.thematicAssignment.findMany({
      where: targetYear == null ? {} : { action: { year: targetYear } },
      select: {
        action: {
          select: {
            year: true, organizationCode: true, organizationName: true,
            unitCode: true, unitName: true, projectActivity: true, application: true,
          },
        },
      },
    }),
  ]);

  const qddKeys = new Set(qddActions.map((a) => actionLogicalKey(a)));

  // Ações distintas que possuem marcação hoje, deduplicadas pela chave lógica.
  const classifiedByKey = new Map<string, ActionKeyFields>();
  for (const { action } of assignments) {
    if (!action) continue;
    classifiedByKey.set(actionLogicalKey(action), action);
  }

  let preserved = 0;
  const unmatched: NonNullable<StructureDiff['markers']>['unmatched'] = [];
  for (const [key, action] of classifiedByKey) {
    if (qddKeys.has(key)) {
      preserved += 1;
    } else {
      unmatched.push({
        organizationCode: action.organizationCode,
        organizationName: action.organizationName,
        unitCode: action.unitCode,
        unitName: action.unitName,
        projectActivity: action.projectActivity,
        application: action.application,
      });
    }
  }
  unmatched.sort((a, b) =>
    `${a.organizationCode}-${a.unitCode}-${a.projectActivity}`.localeCompare(
      `${b.organizationCode}-${b.unitCode}-${b.projectActivity}`,
    ),
  );

  return { classifiedActions: classifiedByKey.size, preserved, unmatched };
}

export async function buildStructureDiff(
  source: 'preview' | 'vigente',
  previewId?: string,
  year?: number | null,
): Promise<StructureDiff> {
  const context = await loadDiffContext(source, previewId, year);
  return buildStructureDiffFromContext(context);
}

/** Mesma conferência, quando o contexto já foi carregado (evita reler a prévia). */
export async function buildStructureDiffFromContext(context: DiffContext): Promise<StructureDiff> {
  const [catalog, markers] = await Promise.all([
    listGovernmentStructure(context.year),
    buildMarkersProjection(context),
  ]);
  return {
    ...diffGovernmentStructure(context.pairs, catalog),
    markers,
    year: context.year,
    // Exercício ainda sem cadastro: tudo aparece como "novo", e isso é o correto —
    // é a primeira importação do exercício, não uma divergência a corrigir.
    catalogEmpty: catalog.organizations.length === 0,
  };
}

import 'server-only';

import { prisma } from './prisma';
import { getVigenteImportId } from './store';
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

export async function listGovernmentStructure(): Promise<GovernmentStructure> {
  const rows = await prisma.governmentOrganization.findMany({
    where: { active: true },
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

export function diffGovernmentStructure(
  qddPairs: StructurePair[],
  catalog: GovernmentStructure,
): StructureDiff {
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
): Promise<void> {
  const pairByOrg = new Map(qddPairs.map((p) => [p.organizationCode, p]));
  const pairByUnit = new Map(qddPairs.map((p) => [`${p.organizationCode}|${p.unitCode}`, p]));

  const newOrgCodes = new Set(selection.newOrganizationCodes ?? []);
  for (const org of diff.newOrganizations) {
    if (!newOrgCodes.has(org.code)) continue;
    const pair = pairByOrg.get(org.code);
    await prisma.governmentOrganization.upsert({
      where: { code: org.code },
      update: { name: org.name, active: true },
      create: {
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
    await prisma.governmentOrganization.upsert({
      where: { code: unit.organizationCode },
      update: {},
      create: {
        code: unit.organizationCode,
        name: orgName,
        type: 'SECRETARIA',
        active: true,
      },
    });
    await prisma.governmentUnit.upsert({
      where: { organizationCode_code: { organizationCode: unit.organizationCode, code: unit.code } },
      update: { name: unit.name, active: true },
      create: {
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
    await prisma.governmentOrganization.update({
      where: { code: org.code },
      data: { name: org.qddName },
    });
  }

  const renameUnitKeys = new Set(
    (selection.renamedUnits ?? []).map((u) => `${u.organizationCode}|${u.code}`),
  );
  for (const unit of diff.renamedUnits) {
    const key = `${unit.organizationCode}|${unit.code}`;
    if (!renameUnitKeys.has(key)) continue;
    await prisma.governmentUnit.update({
      where: { organizationCode_code: { organizationCode: unit.organizationCode, code: unit.code } },
      data: { name: unit.qddName },
    });
  }

  const deactivateOrgCodes = new Set(selection.deactivateOrganizationCodes ?? []);
  for (const org of diff.missingOrganizations) {
    if (!deactivateOrgCodes.has(org.code)) continue;
    await prisma.governmentOrganization.update({
      where: { code: org.code },
      data: { active: false },
    });
  }

  const deactivateUnitKeys = new Set(
    (selection.deactivateUnits ?? []).map((u) => `${u.organizationCode}|${u.code}`),
  );
  for (const unit of diff.missingUnits) {
    const key = `${unit.organizationCode}|${unit.code}`;
    if (!deactivateUnitKeys.has(key)) continue;
    await prisma.governmentUnit.update({
      where: { organizationCode_code: { organizationCode: unit.organizationCode, code: unit.code } },
      data: { active: false },
    });
  }
}

export async function syncStructureFromImport(actions: ActionLike[]): Promise<void> {
  const pairs = extractPairsFromActions(actions);
  const orgNames = new Map<string, string>();

  for (const pair of pairs) {
    orgNames.set(pair.organizationCode, pair.organizationName);
  }

  for (const [code, name] of orgNames) {
    await prisma.governmentOrganization.upsert({
      where: { code },
      update: { name },
      create: { code, name, type: 'SECRETARIA', active: true },
    });
  }

  for (const pair of pairs) {
    await prisma.governmentUnit.upsert({
      where: {
        organizationCode_code: { organizationCode: pair.organizationCode, code: pair.unitCode },
      },
      update: { name: pair.unitName, active: true },
      create: {
        organizationCode: pair.organizationCode,
        code: pair.unitCode,
        name: pair.unitName,
        active: true,
      },
    });
  }
}

export async function getQddPairsForDiff(
  source: 'preview' | 'vigente',
  previewId?: string,
): Promise<StructurePair[]> {
  if (source === 'preview') {
    if (!previewId) throw new Error('previewId é obrigatório para source=preview.');
    const preview = await prisma.importPreview.findUnique({ where: { id: previewId } });
    if (!preview) throw new Error('Prévia não encontrada.');
    const parsed = preview.data as { actions?: ActionLike[] };
    return extractPairsFromActions(parsed.actions ?? []);
  }

  const vigenteId = await getVigenteImportId();
  if (!vigenteId) return [];

  const actions = await prisma.budgetAction.findMany({
    where: { importId: vigenteId },
    select: {
      organizationCode: true,
      organizationName: true,
      unitCode: true,
      unitName: true,
    },
  });
  return extractPairsFromActions(actions);
}

export async function buildStructureDiff(
  source: 'preview' | 'vigente',
  previewId?: string,
): Promise<StructureDiff> {
  const [catalog, qddPairs] = await Promise.all([
    listGovernmentStructure(),
    getQddPairsForDiff(source, previewId),
  ]);
  return diffGovernmentStructure(qddPairs, catalog);
}

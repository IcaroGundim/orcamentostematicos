type PayrollOrganizationRow = {
  key: string;
  secondaryKey?: string | null;
  headcount: number;
};

type PayrollScopeSource = {
  snapshot: {
    year: number;
    month: number;
    headcount: number;
  } | null;
  byOrganization: PayrollOrganizationRow[];
  byOrganizationContract: PayrollOrganizationRow[];
};

export type PayrollContractHeadcount = {
  label: string;
  headcount: number;
};

export type PayrollHeadcountScope = {
  headcount: number | null;
  year: number;
  month: number;
  matchedOrganizations: string[];
  isStatewidePayroll: boolean;
  contracts: PayrollContractHeadcount[];
  excludedInactiveHeadcount: number;
};

/*
 * O Portal da Transparência publica a folha por nome do órgão, sem os códigos de
 * órgão/unidade usados pelo QDD. Este mapa mantém a associação auditável e evita
 * que uma aproximação textual atribua vínculos a uma unidade errada.
 */
const PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE: Record<string, readonly string[]> = {
  '444/001': ['ESCRITORIO DE REPRESENTACAO EM BRASILIA'],
  '445/001': ['SECRETARIA DE ESTADO DE GOVERNO'],
  '446/001': ['SECRETARIA DE ESTADO DA CASA CIVIL'],
  '447/001': ['GABINETE MILITAR DO GOVERNADOR'],
  '448/001': ['CONTROLADORIA GERAL DO ESTADO'],
  '450/001': ['GABINETE DA VICE GOVERNADORA'],
  '451/001': ['POLICIA CIVIL DO ESTADO DO ACRE'],
  '452/001': ['COORDENADORIA ESTADUAL DE PROTECAO E DEFESA CIVIL'],
  '510/001': ['PROCURADORIA GERAL DO ESTADO'],
  '608/001': ['POLICIA MILITAR DO ACRE'],
  '609/001': ['CORPO DE BOMBEIROS MILITAR DO ACRE'],
  '711/001': ['SECRETARIA DE COMUNICACAO'],
  '711/308': ['FUNDACAO ALDEIA DE COMUNICACAO DO ACRE'],
  '713/001': ['SECRETARIA DE ESTADO DE PLANEJAMENTO'],
  '714/001': ['SECRETARIA DE ESTADO DE ADMINISTRACAO'],
  '714/211': ['INSTITUTO DE PREVIDENCIA DO ESTADO DO ACRE'],
  '714/306': ['FUNDACAO CULTURAL'],
  '715/001': ['SECRETARIA DA FAZENDA'],
  '715/205': ['JUNTA COMERCIAL DO ESTADO DO ACRE'],
  '715/210': ['AGENCIA REGULADORA DOS SERVICOS PUBLICOS DO ACRE'],
  '715/403': ['COMPANHIA DE DESENVOLVIMENTO INDUSTRIAL DO ACRE'],
  '715/404': ['COMPANHIA DE DESENVOLVIMENTO AGRARIO E COLONIZACAO'],
  '715/501': ['COMPANHIA DE HABITACAO DO ACRE'],
  '715/502': ['COMPANHIA DE SANEAMENTO DO ESTADO DO ACRE'],
  '715/504': ['COMPANHIA INDUSTRIAL DE LATICINIOS DO ACRE'],
  '717/001': ['SECRETARIA DE ESTADO DA EDUCACAO E CULTURA'],
  '717/212': ['INSTITUTO DE EDUCACAO PROFISSIONAL E TECNOLOGICA'],
  '717/303': ['FUNDACAO DE CULTURA E COMUNICACAO ELIAS MANSOUR'],
  '717/306': ['FUNDACAO CULTURAL'],
  '718/001': ['SECRETARIA EXTRAORDINARIA DE ESPORTE E LAZER'],
  '719/001': ['SECRETARIA DE ESTADO DE JUSTICA E SEGURANCA PUBLICA'],
  '719/204': ['DEPARTAMENTO ESTADUAL DE TRANSITO'],
  '719/209': ['INSTITUTO DE ADMINISTRACAO PENITENCIARIA'],
  '719/213': ['INSTITUTO SOCIO EDUCATIVO DO ACRE'],
  '719/216': ['INSTITUTO DE PROTECAO E DEFESA DO CONSUMIDOR DO ESTADO DO ACRE'],
  '720/001': ['SECRETARIA DE MEIO AMBIENTE'],
  '720/202': ['INSTITUTO DE MEIO AMBIENTE DO ACRE'],
  '720/206': ['INSTITUTO DE TERRAS DO ACRE'],
  '720/215': ['INSTITUTO DE MUDANCAS CLIMATICAS'],
  '721/001': ['SECRETARIA DE ESTADO DE SAUDE'],
  '721/302': ['HOSPITAL DAS CLINICAS DO ACRE'],
  '722/001': ['SECRETARIA EXTRAORDINARIA DOS POVOS INDIGENAS'],
  '744/001': ['SECRETARIA DE ESTADO DE HABITACAO E URBANISMO'],
  '744/201': ['DEPARTAMENTO DE ESTRADAS DE RODAGEM ACRE'],
  '744/203': ['SERVICO DE AGUA E ESGOTO DO ESTADO DO ACRE'],
  '744/206': ['INSTITUTO DE TERRAS DO ACRE'],
  '753/001': ['SECRETARIA DE ESTADO DE AGRICULTURA'],
  '753/207': ['INSTITUTO DE DEFESA AGROPECUARIA E FLORESTAL'],
  '753/401': ['COMPANHIA DE ARMAZENS GERAIS E ENTREPOSTOS'],
  '753/402': ['EMPRESA DE ASSISTENCIA TECNICA E EXTENSAO RURAL'],
  '754/001': ['SECRETARIA DE ESTADO DE OBRAS PUBLICAS'],
  '754/203': ['SERVICO DE AGUA E ESGOTO DO ESTADO DO ACRE'],
  '754/210': ['AGENCIA REGULADORA DOS SERVICOS PUBLICOS DO ACRE'],
  '754/502': ['COMPANHIA DE SANEAMENTO DO ESTADO DO ACRE'],
  '759/001': ['SECRETARIA DE ESTADO DE TURISMO E EMPREENDEDORISMO'],
  '760/001': ['SECRETARIA DE ESTADO DE ASSISTENCIA SOCIAL E DIREITOS HUMANOS'],
  '760/216': ['INSTITUTO DE PROTECAO E DEFESA DO CONSUMIDOR DO ESTADO DO ACRE'],
  '760/304': ['FUNDACAO DO BEM ESTAR SOCIAL DO ACRE'],
  '760/307': ['FUNDACAO DE APOIO AO DESENVOL ECONOMICO E SOCIAL'],
  '761/001': ['SECRETARIA DE ESTADO DE INDUSTRIA CIENCIA E TECNOLOGIA'],
  '761/214': ['INSTITUTO DE PESOS E MEDIDAS DO ESTADO DO ACRE'],
  '761/301': ['FUNDACAO DE TECNOLOGIA DO ESTADO DO ACRE'],
  '761/309': ['FUNDACAO DE AMPARO A PESQUISA DO ESTADO DO ACRE'],
  '761/503': ['EMPRESA DE PROCESSAMENTO DE DADOS ACRE'],
  '762/001': ['SECRETARIA DE ESTADO DA MULHER'],
};

function normalizePayrollOrganization(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isInactiveContract(value: string | null | undefined) {
  const normalized = normalizePayrollOrganization(value ?? '');
  return (
    normalized.includes('APOSENT') ||
    normalized.includes('PENSION') ||
    normalized.includes('INATIV')
  );
}

function aggregateContracts(rows: PayrollOrganizationRow[]) {
  const contracts = new Map<string, number>();
  let excludedInactiveHeadcount = 0;

  for (const row of rows) {
    if (isInactiveContract(row.secondaryKey)) {
      excludedInactiveHeadcount += row.headcount;
      continue;
    }
    const label = row.secondaryKey?.trim() || 'Não informado';
    contracts.set(label, (contracts.get(label) ?? 0) + row.headcount);
  }

  const activeContracts = [...contracts.entries()]
    .map(([label, headcount]) => ({ label, headcount }))
    .sort((a, b) => b.headcount - a.headcount || a.label.localeCompare(b.label, 'pt-BR'));

  return {
    contracts: activeContracts,
    headcount: activeContracts.reduce((sum, contract) => sum + contract.headcount, 0),
    excludedInactiveHeadcount,
  };
}

export function payrollHeadcountForQddScope(
  payroll: PayrollScopeSource | null,
  organizationCode: string,
  unitFilter: string,
  allValue: string,
): PayrollHeadcountScope | null {
  if (!payroll?.snapshot || !organizationCode || organizationCode === allValue) {
    return null;
  }

  if (unitFilter === '714|002') {
    const statewideContracts = aggregateContracts(payroll.byOrganizationContract);
    return {
      headcount: statewideContracts.headcount,
      year: payroll.snapshot.year,
      month: payroll.snapshot.month,
      matchedOrganizations: ['Folha estadual consolidada'],
      isStatewidePayroll: true,
      contracts: statewideContracts.contracts,
      excludedInactiveHeadcount: statewideContracts.excludedInactiveHeadcount,
    };
  }

  const selectedUnitCode =
    unitFilter === allValue ? null : unitFilter.split('|')[1] ?? null;
  const scopePrefix = `${organizationCode}/`;
  const aliases =
    selectedUnitCode === null
      ? Object.entries(PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE)
          .filter(([scope]) => scope.startsWith(scopePrefix))
          .flatMap(([, values]) => values)
      : PAYROLL_ORGANIZATIONS_BY_QDD_SCOPE[
          `${organizationCode}/${selectedUnitCode}`
        ] ?? [];

  if (!aliases.length) {
    return {
      headcount: null,
      year: payroll.snapshot.year,
      month: payroll.snapshot.month,
      matchedOrganizations: [],
      isStatewidePayroll: false,
      contracts: [],
      excludedInactiveHeadcount: 0,
    };
  }

  const rowsByName = new Map(
    payroll.byOrganization.map((row) => [
      normalizePayrollOrganization(row.key),
      row,
    ]),
  );
  const matchedRows = new Map<string, PayrollOrganizationRow>();

  for (const alias of aliases) {
    const row = rowsByName.get(normalizePayrollOrganization(alias));
    if (row) matchedRows.set(normalizePayrollOrganization(row.key), row);
  }

  if (!matchedRows.size) {
    return {
      headcount: null,
      year: payroll.snapshot.year,
      month: payroll.snapshot.month,
      matchedOrganizations: [],
      isStatewidePayroll: false,
      contracts: [],
      excludedInactiveHeadcount: 0,
    };
  }

  const rows = [...matchedRows.values()];
  const matchedOrganizationNames = new Set(
    rows.map((row) => normalizePayrollOrganization(row.key)),
  );
  const contractBreakdown = aggregateContracts(
    payroll.byOrganizationContract.filter((row) =>
      matchedOrganizationNames.has(normalizePayrollOrganization(row.key)),
    ),
  );
  return {
    headcount: contractBreakdown.headcount,
    year: payroll.snapshot.year,
    month: payroll.snapshot.month,
    matchedOrganizations: rows.map((row) => row.key),
    isStatewidePayroll: false,
    contracts: contractBreakdown.contracts,
    excludedInactiveHeadcount: contractBreakdown.excludedInactiveHeadcount,
  };
}

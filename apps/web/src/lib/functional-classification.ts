import { functionalProgramPrefix } from '@/components/domain/functional-program-line';
import type { BudgetAction } from '@/types/domain';

export const FUNCTIONS: Record<string, string> = {
  '01': 'Legislativa',
  '02': 'Judiciária',
  '03': 'Essencial à Justiça',
  '04': 'Administração',
  '05': 'Defesa Nacional',
  '06': 'Segurança Pública',
  '07': 'Relações Exteriores',
  '08': 'Assistência Social',
  '09': 'Previdência Social',
  '10': 'Saúde',
  '11': 'Trabalho',
  '12': 'Educação',
  '13': 'Cultura',
  '14': 'Direitos da Cidadania',
  '15': 'Urbanismo',
  '16': 'Habitação',
  '17': 'Saneamento',
  '18': 'Gestão Ambiental',
  '19': 'Ciência e Tecnologia',
  '20': 'Agricultura',
  '21': 'Organização Agrária',
  '22': 'Indústria',
  '23': 'Comércio e Serviços',
  '24': 'Comunicações',
  '25': 'Energia',
  '26': 'Transporte',
  '27': 'Desporto e Lazer',
  '28': 'Encargos Especiais',
};

export const SUBFUNCTIONS_BY_FUNCTION: Record<string, Record<string, string>> = {
  '01': { '031': 'Ação Legislativa', '032': 'Controle Externo' },
  '02': {
    '061': 'Ação Judiciária',
    '062': 'Defesa do Interesse Público no Processo Judiciário',
  },
  '03': {
    '091': 'Defesa da Ordem Jurídica',
    '092': 'Representação Judicial e Extrajudicial',
  },
  '04': {
    '121': 'Planejamento e Orçamento',
    '122': 'Administração Geral',
    '123': 'Administração Financeira',
    '124': 'Controle Interno',
    '125': 'Normatização e Fiscalização',
    '126': 'Tecnologia da Informação',
    '127': 'Ordenamento Territorial',
    '128': 'Formação de Recursos Humanos',
    '129': 'Administração de Receitas',
    '130': 'Administração de Concessões',
    '131': 'Comunicação Social',
  },
  '05': { '151': 'Defesa Aérea', '152': 'Defesa Naval', '153': 'Defesa Terrestre' },
  '06': { '181': 'Policiamento', '182': 'Defesa Civil', '183': 'Informação e Inteligência' },
  '07': { '211': 'Relações Diplomáticas', '212': 'Cooperação Internacional' },
  '08': {
    '241': 'Assistência à Pessoa Idosa',
    '242': 'Assistência à Pessoa com Deficiência',
    '243': 'Assistência à Criança e ao Adolescente',
    '244': 'Assistência Comunitária',
    '245': 'Serviços Socioassistenciais',
    '246': 'Segurança de Renda',
  },
  '09': {
    '271': 'Previdência Básica',
    '272': 'Previdência do Regime Estatutário',
    '273': 'Previdência Complementar',
    '274': 'Previdência Especial',
  },
  '10': {
    '301': 'Atenção Básica',
    '302': 'Assistência Hospitalar e Ambulatorial',
    '303': 'Suporte Profilático e Terapêutico',
    '304': 'Vigilância Sanitária',
    '305': 'Vigilância Epidemiológica',
    '306': 'Alimentação e Nutrição',
  },
  '11': {
    '331': 'Proteção e Benefícios ao Trabalhador',
    '332': 'Relações de Trabalho',
    '333': 'Empregabilidade',
    '334': 'Fomento ao Trabalho',
  },
  '12': {
    '361': 'Ensino Fundamental',
    '362': 'Ensino Médio',
    '363': 'Ensino Profissional',
    '364': 'Ensino Superior',
    '365': 'Educação Infantil',
    '366': 'Educação de Jovens e Adultos',
    '367': 'Educação Especial',
    '368': 'Educação Básica',
  },
  '13': {
    '391': 'Patrimônio Histórico, Artístico e Arqueológico',
    '392': 'Difusão Cultural',
  },
  '14': {
    '421': 'Custódia e Reintegração Social',
    '422': 'Direitos Individuais, Coletivos e Difusos',
    '423': 'Assistência aos Povos Indígenas',
  },
  '15': {
    '451': 'Infra-Estrutura Urbana',
    '452': 'Serviços Urbanos',
    '453': 'Transportes Coletivos Urbanos',
  },
  '16': { '481': 'Habitação Rural', '482': 'Habitação Urbana' },
  '17': { '511': 'Saneamento Básico Rural', '512': 'Saneamento Básico Urbano' },
  '18': {
    '541': 'Preservação e Conservação Ambiental',
    '542': 'Controle Ambiental',
    '543': 'Recuperação de Áreas Degradadas',
    '544': 'Recursos Hídricos',
    '545': 'Meteorologia',
  },
  '19': {
    '571': 'Desenvolvimento Científico',
    '572': 'Desenvolvimento Tecnológico e Engenharia',
    '573': 'Difusão do Conhecimento Científico e Tecnológico',
  },
  '20': {
    '601': 'Promoção da Produção Vegetal',
    '602': 'Promoção da Produção Animal',
    '603': 'Defesa Sanitária Vegetal',
    '604': 'Defesa Sanitária Animal',
    '605': 'Abastecimento',
    '606': 'Extensão Rural',
    '607': 'Irrigação',
  },
  '21': { '631': 'Reforma Agrária', '632': 'Colonização' },
  '22': {
    '661': 'Promoção Industrial',
    '662': 'Produção Industrial',
    '663': 'Mineração',
    '664': 'Propriedade Industrial',
    '665': 'Normalização e Qualidade',
  },
  '23': {
    '691': 'Promoção Comercial',
    '692': 'Comercialização',
    '693': 'Comércio Exterior',
    '694': 'Serviços Financeiros',
    '695': 'Turismo',
  },
  '24': { '721': 'Comunicações Postais', '722': 'Telecomunicações' },
  '25': {
    '751': 'Conservação de Energia',
    '752': 'Energia Elétrica',
    '753': 'Combustíveis Minerais',
    '754': 'Biocombustíveis',
  },
  '26': {
    '781': 'Transporte Aéreo',
    '782': 'Transporte Rodoviário',
    '783': 'Transporte Ferroviário',
    '784': 'Transporte Hidroviário',
    '785': 'Transportes Especiais',
  },
  '27': { '811': 'Desporto de Rendimento', '812': 'Desporto Comunitário', '813': 'Lazer' },
  '28': {
    '841': 'Refinanciamento da Dívida Interna',
    '842': 'Refinanciamento da Dívida Externa',
    '843': 'Serviço da Dívida Interna',
    '844': 'Serviço da Dívida Externa',
    '845': 'Outras Transferências',
    '846': 'Outros Encargos Especiais',
    '847': 'Transferências para a Educação Básica',
  },
};

/** Mapa global código de subfunção → nome (para rótulos quando a função não está selecionada). */
const SUBFUNCTION_LABELS: Record<string, string> = Object.values(SUBFUNCTIONS_BY_FUNCTION).reduce(
  (acc, subs) => {
    for (const [code, name] of Object.entries(subs)) {
      acc[code] = name;
    }
    return acc;
  },
  {} as Record<string, string>,
);

export type FunctionalClassification = {
  functionCode: string;
  subfunctionCode: string;
};

export type FunctionalFilterOption = {
  value: string;
  label: string;
};

export type FunctionalColumnFilterValue = {
  functionCode: string;
  subfunctionCode: string;
};

function extractFunctionalDigits(functionalProgram: string, projectActivity?: string): string {
  const prefix = functionalProgramPrefix(
    functionalProgram.trim(),
    (projectActivity ?? '').trim(),
  );
  return prefix.replace(/\D/g, '');
}

export function parseFunctionalClassification(
  functionalProgram: string,
  projectActivity?: string,
): FunctionalClassification | null {
  const digits = extractFunctionalDigits(functionalProgram, projectActivity);
  if (digits.length < 5) return null;
  return {
    functionCode: digits.slice(0, 2),
    subfunctionCode: digits.slice(2, 5),
  };
}

export function formatFunctionLabel(code: string): string {
  const name = FUNCTIONS[code];
  return name ? `${code} — ${name}` : `${code} — código não catalogado`;
}

export function formatSubfunctionLabel(code: string, functionCode?: string): string {
  const name =
    (functionCode && SUBFUNCTIONS_BY_FUNCTION[functionCode]?.[code]) ||
    SUBFUNCTION_LABELS[code];
  return name ? `${code} — ${name}` : `${code} — código não catalogado`;
}

/**
 * Códigos de projeto/atividade iniciados em 8 que correspondem ao controle da
 * dívida do Estado do Acre (80000000 e a faixa contígua 80010000–80270000) e
 * que, portanto, NÃO são emendas parlamentares.
 */
export const AMENDMENT_DEBT_CONTROL_CODES: ReadonlySet<string> = new Set([
  '80000000',
  ...Array.from({ length: 27 }, (_, index) => `80${String(index + 1).padStart(2, '0')}0000`),
]);

/**
 * Uma ação é uma emenda quando o projeto/atividade começa com "8", exceto os
 * códigos de controle da dívida ({@link AMENDMENT_DEBT_CONTROL_CODES}).
 */
export function actionIsAmendment(action: Pick<BudgetAction, 'projectActivity'>): boolean {
  const activity = action.projectActivity.trim();
  return activity.startsWith('8') && !AMENDMENT_DEBT_CONTROL_CODES.has(activity);
}

export function actionMatchesFunctionalFilters(
  action: Pick<BudgetAction, 'functionalProgram' | 'projectActivity'>,
  functionFilter: string,
  subfunctionFilter: string,
  allValue: string,
): boolean {
  const hasFunctionFilter = functionFilter !== allValue;
  const hasSubfunctionFilter = subfunctionFilter !== allValue;
  if (!hasFunctionFilter && !hasSubfunctionFilter) return true;

  const parsed = parseFunctionalClassification(action.functionalProgram, action.projectActivity);
  if (!parsed) return false;

  if (hasFunctionFilter && parsed.functionCode !== functionFilter) return false;
  if (hasSubfunctionFilter && parsed.subfunctionCode !== subfunctionFilter) return false;
  return true;
}

function collectClassificationsFromActions(
  actions: Pick<BudgetAction, 'functionalProgram' | 'projectActivity'>[],
) {
  const functions = new Set<string>();
  const subfunctions = new Set<string>();
  const subfunctionsByFunction = new Map<string, Set<string>>();

  for (const action of actions) {
    const parsed = parseFunctionalClassification(action.functionalProgram, action.projectActivity);
    if (!parsed) continue;
    functions.add(parsed.functionCode);
    subfunctions.add(parsed.subfunctionCode);
    const bucket = subfunctionsByFunction.get(parsed.functionCode) ?? new Set<string>();
    bucket.add(parsed.subfunctionCode);
    subfunctionsByFunction.set(parsed.functionCode, bucket);
  }

  return { functions, subfunctions, subfunctionsByFunction };
}

export function buildFunctionFilterOptions(
  actions: Pick<BudgetAction, 'functionalProgram' | 'projectActivity'>[],
  allValue: string,
): FunctionalFilterOption[] {
  const { functions } = collectClassificationsFromActions(actions);
  const options: FunctionalFilterOption[] = [{ value: allValue, label: 'Todas as funções' }];
  for (const code of [...functions].sort()) {
    options.push({ value: code, label: formatFunctionLabel(code) });
  }
  return options;
}

export function buildSubfunctionFilterOptions(
  actions: Pick<BudgetAction, 'functionalProgram' | 'projectActivity'>[],
  functionFilter: string,
  allValue: string,
): FunctionalFilterOption[] {
  const { subfunctions, subfunctionsByFunction } = collectClassificationsFromActions(actions);
  const options: FunctionalFilterOption[] = [{ value: allValue, label: 'Todas as subfunções' }];

  if (functionFilter !== allValue) {
    const codes = subfunctionsByFunction.get(functionFilter);
    const catalog = SUBFUNCTIONS_BY_FUNCTION[functionFilter] ?? {};
    const list = codes ? [...codes] : Object.keys(catalog);
    for (const code of list.sort()) {
      options.push({ value: code, label: formatSubfunctionLabel(code, functionFilter) });
    }
    return options;
  }

  for (const code of [...subfunctions].sort()) {
    options.push({ value: code, label: formatSubfunctionLabel(code) });
  }
  return options;
}

export function functionalColumnFilterMatches(
  action: Pick<BudgetAction, 'functionalProgram' | 'projectActivity'>,
  filterValue: FunctionalColumnFilterValue | undefined,
  allValue: string,
): boolean {
  if (!filterValue) return true;
  return actionMatchesFunctionalFilters(
    action,
    filterValue.functionCode,
    filterValue.subfunctionCode,
    allValue,
  );
}

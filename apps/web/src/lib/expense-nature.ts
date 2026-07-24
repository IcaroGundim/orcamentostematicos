/**
 * Natureza da despesa — parser e catálogos.
 *
 * O QDD traz a natureza como código completo em `ExpenseLine.expenseAccount`,
 * com seis grupos separados por espaço (ex.: `3 1 90 13 00 00`):
 *
 * | Posição | Significado            | Exemplo |
 * | ------- | ---------------------- | ------- |
 * | 1       | Categoria econômica    | `3`     |
 * | 2       | Grupo de natureza      | `1`     |
 * | 3       | Modalidade de aplicação| `90`    |
 * | 4       | **Elemento de despesa**| `13`    |
 * | 5-6     | Subelemento            | `00 00` |
 *
 * Agrupar pelo código cru **não** dá o elemento de despesa: no QDD vigente há 110
 * códigos completos distintos para apenas 53 elementos. Daí este parser.
 */

export const EXPENSE_CATEGORIES: Record<string, string> = {
  '3': 'Despesas Correntes',
  '4': 'Despesas de Capital',
  '9': 'Reserva de Contingência',
};

export const EXPENSE_GROUPS: Record<string, string> = {
  '1': 'Pessoal e Encargos Sociais',
  '2': 'Juros e Encargos da Dívida',
  '3': 'Outras Despesas Correntes',
  '4': 'Investimentos',
  '5': 'Inversões Financeiras',
  '6': 'Amortização da Dívida',
  '9': 'Reserva de Contingência',
};

export const EXPENSE_MODALITIES: Record<string, string> = {
  '20': 'Transferências à União',
  '30': 'Transferências a Estados e ao Distrito Federal',
  '31': 'Transferências a Estados e ao DF — Fundo a Fundo',
  '40': 'Transferências a Municípios',
  '41': 'Transferências a Municípios — Fundo a Fundo',
  '50': 'Transferências a Instituições Privadas sem Fins Lucrativos',
  '60': 'Transferências a Instituições Privadas com Fins Lucrativos',
  '70': 'Transferências a Instituições Multigovernamentais',
  '71': 'Transferências a Consórcios Públicos',
  '72': 'Execução Orçamentária Delegada a Consórcios Públicos',
  '80': 'Transferências ao Exterior',
  '90': 'Aplicações Diretas',
  '91': 'Aplicação Direta — Operação entre Órgãos e Fundos',
  '93': 'Aplicação Direta — Consórcio Público do qual o Ente Participe',
  '94': 'Aplicação Direta — Consórcio Público do qual o Ente Não Participe',
  '95': 'Aplicação Direta — Recursos do art. 24, §§1º e 2º, da LC 141/2012',
  '96': 'Aplicação Direta — Recursos do art. 25 da LC 141/2012',
  '99': 'A Definir',
};

/**
 * Elementos de despesa (Portaria Interministerial STN/SOF). Os 53 presentes no QDD
 * vigente do Acre estão todos aqui; os demais ficam catalogados para não quebrar
 * quando aparecerem em importações futuras.
 */
export const EXPENSE_ELEMENTS: Record<string, string> = {
  '01': 'Aposentadorias do RPPS, Reserva Remunerada e Reformas dos Militares',
  '03': 'Pensões do RPPS e do Militar',
  '04': 'Contratação por Tempo Determinado',
  '05': 'Outros Benefícios Previdenciários do Servidor ou do Militar',
  '06': 'Benefício Mensal ao Deficiente e ao Idoso',
  '07': 'Contribuição a Entidades Fechadas de Previdência',
  '08': 'Outros Benefícios Assistenciais do Servidor e do Militar',
  '11': 'Vencimentos e Vantagens Fixas — Pessoal Civil',
  '12': 'Vencimentos e Vantagens Fixas — Pessoal Militar',
  '13': 'Obrigações Patronais',
  '14': 'Diárias — Pessoal Civil',
  '15': 'Diárias — Pessoal Militar',
  '16': 'Outras Despesas Variáveis — Pessoal Civil',
  '17': 'Outras Despesas Variáveis — Pessoal Militar',
  '18': 'Auxílio Financeiro a Estudantes',
  '19': 'Auxílio-Fardamento',
  '20': 'Auxílio Financeiro a Pesquisadores',
  '21': 'Juros sobre a Dívida por Contrato',
  '22': 'Outros Encargos sobre a Dívida por Contrato',
  '23': 'Juros, Deságios e Descontos da Dívida Mobiliária',
  '24': 'Outros Encargos sobre a Dívida Mobiliária',
  '25': 'Encargos sobre Operações de Crédito por Antecipação da Receita',
  '26': 'Obrigações Decorrentes de Política Monetária',
  '27': 'Encargos pela Honra de Avais, Garantias, Seguros e Similares',
  '28': 'Remuneração de Cotas de Fundos Autárquicos',
  '29': 'Distribuição de Resultado de Empresas Estatais Dependentes',
  '30': 'Material de Consumo',
  '31': 'Premiações Culturais, Artísticas, Científicas, Desportivas e Outras',
  '32': 'Material, Bem ou Serviço para Distribuição Gratuita',
  '33': 'Passagens e Despesas com Locomoção',
  '34': 'Outras Despesas de Pessoal decorrentes de Contratos de Terceirização',
  '35': 'Serviços de Consultoria',
  '36': 'Outros Serviços de Terceiros — Pessoa Física',
  '37': 'Locação de Mão de Obra',
  '38': 'Arrendamento Mercantil',
  '39': 'Outros Serviços de Terceiros — Pessoa Jurídica',
  '40': 'Serviços de Tecnologia da Informação e Comunicação — Pessoa Jurídica',
  '41': 'Contribuições',
  '42': 'Auxílios',
  '43': 'Subvenções Sociais',
  '45': 'Subvenções Econômicas',
  '46': 'Auxílio-Alimentação',
  '47': 'Obrigações Tributárias e Contributivas',
  '48': 'Outros Auxílios Financeiros a Pessoas Físicas',
  '49': 'Auxílio-Transporte',
  '51': 'Obras e Instalações',
  '52': 'Equipamentos e Material Permanente',
  '53': 'Aposentadorias do RGPS — Área Rural',
  '54': 'Aposentadorias do RGPS — Área Urbana',
  '55': 'Pensões do RGPS — Área Rural',
  '56': 'Pensões do RGPS — Área Urbana',
  '59': 'Pensões Especiais',
  '61': 'Aquisição de Imóveis',
  '62': 'Aquisição de Produtos para Revenda',
  '63': 'Aquisição de Títulos de Crédito',
  '64': 'Aquisição de Títulos Representativos de Capital já Integralizado',
  '65': 'Constituição ou Aumento de Capital de Empresas',
  '66': 'Concessão de Empréstimos e Financiamentos',
  '67': 'Depósitos Compulsórios',
  '70': 'Rateio pela Participação em Consórcio Público',
  '71': 'Principal da Dívida Contratual Resgatado',
  '72': 'Principal da Dívida Mobiliária Resgatado',
  '73': 'Correção Monetária ou Cambial da Dívida Contratual Resgatada',
  '74': 'Correção Monetária ou Cambial da Dívida Mobiliária Resgatada',
  '75': 'Correção Monetária da Dívida de Operações de Crédito por Antecipação da Receita',
  '76': 'Principal Corrigido da Dívida Mobiliária Refinanciado',
  '77': 'Principal Corrigido da Dívida Contratual Refinanciado',
  '81': 'Distribuição Constitucional ou Legal de Receitas',
  '82': 'Aporte de Recursos pelo Parceiro Público em Favor do Parceiro Privado',
  '83': 'Despesas Decorrentes de Contrato de PPP',
  '84': 'Despesas Decorrentes da Participação em Fundos e Organismos',
  '86': 'Compensações a Regimes de Previdência',
  '91': 'Sentenças Judiciais',
  '92': 'Despesas de Exercícios Anteriores',
  '93': 'Indenizações e Restituições',
  '94': 'Indenizações e Restituições Trabalhistas',
  '95': 'Indenização pela Execução de Trabalhos de Campo',
  '96': 'Ressarcimento de Despesas de Pessoal Requisitado',
  '97': 'Aporte para Cobertura do Déficit Atuarial do RPPS',
  '98': 'Compensações ao RGPS',
  '99': 'A Classificar',
};

export interface ExpenseNature {
  /** Categoria econômica — posição 1 (`3` corrente, `4` capital, `9` reserva). */
  categoryCode: string;
  /** Grupo de natureza da despesa — posição 2. */
  groupCode: string;
  /** Modalidade de aplicação — posição 3. */
  modalityCode: string;
  /** Elemento de despesa — posição 4. É o eixo principal do monitoramento. */
  elementCode: string;
  /** Subelemento/desdobramento — posições 5-6 unidas por ponto (ex.: `00.00`). */
  subelementCode: string;
}

/**
 * Extrai as partes da natureza da despesa a partir do código do QDD.
 *
 * Aceita os separadores usuais (espaço, ponto ou hífen), então tanto
 * `3 1 90 13 00 00` quanto `3.1.90.13.00.00` funcionam. Retorna `null` quando o
 * código não tem ao menos as quatro primeiras posições — sem elas não há elemento.
 */
export function parseExpenseAccount(account: string | null | undefined): ExpenseNature | null {
  const parts = String(account ?? '')
    .trim()
    .split(/[\s.\-/]+/)
    .filter(Boolean);
  if (parts.length < 4) return null;
  if (!parts.slice(0, 4).every((part) => /^\d+$/.test(part))) return null;

  const [category, group, modality, element] = parts;
  return {
    categoryCode: category!,
    groupCode: group!,
    modalityCode: modality!.padStart(2, '0'),
    elementCode: element!.padStart(2, '0'),
    subelementCode: parts.slice(4).join('.') || '00.00',
  };
}

/** Só o elemento de despesa, quando é tudo o que interessa. */
export function expenseElementCode(account: string | null | undefined): string | null {
  return parseExpenseAccount(account)?.elementCode ?? null;
}

function label(code: string, catalog: Record<string, string>): string {
  const name = catalog[code];
  return name ? `${code} — ${name}` : `${code} — código não catalogado`;
}

export function formatCategoryLabel(code: string): string {
  return label(code, EXPENSE_CATEGORIES);
}

export function formatGroupLabel(code: string): string {
  return label(code, EXPENSE_GROUPS);
}

export function formatModalityLabel(code: string): string {
  return label(code, EXPENSE_MODALITIES);
}

export function formatElementLabel(code: string): string {
  return label(code, EXPENSE_ELEMENTS);
}

/**
 * Nome do elemento sem o código na frente — para eixos de gráfico, onde o código
 * repetido vira ruído. Cai no `fallback` (normalmente a descrição do QDD, que vem
 * truncada) quando o código não está catalogado.
 */
export function expenseElementName(code: string, fallback?: string): string {
  return EXPENSE_ELEMENTS[code] ?? (fallback?.trim() || `Elemento ${code}`);
}

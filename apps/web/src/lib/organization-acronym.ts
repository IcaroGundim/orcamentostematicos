/**
 * Sigla do órgão para exibição compacta (ex: na coluna "Órgão" da Visão Geral).
 *
 * A maioria dos órgãos já traz a sigla no fim do nome cadastrado, após " - "
 * (ex: "SECRETARIA DE ESTADO DE PLANEJAMENTO - SEPLAN" → "SEPLAN"), então a
 * sigla é extraída de lá. Os órgãos abaixo não têm a sigla extraível do nome
 * (poderes/órgãos de controle sem sigla na base, ou cadastro sem o separador)
 * e por isso têm a sigla definida explicitamente.
 */
const ACRONYM_OVERRIDES: Record<string, string> = {
  '101': 'ALEAC',
  '102': 'TCE',
  '203': 'TJAC',
  '304': 'MPAC',
  '305': 'DPE',
  '444': 'REPAC',
  '446': 'SECC',
  '447': 'CASMIL',
  '450': 'GABVICE',
  '452': 'CEPDEC',
  // Cadastrado sem o separador " - ", mas a sigla aparece no fim do nome.
  '720': 'SEMA',
};

/**
 * Retorna a sigla do órgão. Usa o override quando definido; caso contrário,
 * extrai o trecho após o último " - " do nome (em CAIXA ALTA e curto). Se não
 * for possível derivar, retorna o próprio código como identificador.
 */
export function organizationAcronym(code: string, name: string): string {
  const override = ACRONYM_OVERRIDES[code];
  if (override) return override;

  const parts = name.split(' - ');
  if (parts.length > 1) {
    const last = parts[parts.length - 1].trim();
    if (last && last.length <= 12 && last === last.toUpperCase()) return last;
  }

  return code;
}

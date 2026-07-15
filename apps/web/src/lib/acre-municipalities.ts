/** Municípios do estado do Acre (22) + opção para entregas fora do estado. */
export const ACRE_MUNICIPALITY_OPTIONS = [
  'Acrelândia',
  'Assis Brasil',
  'Brasiléia',
  'Bujari',
  'Capixaba',
  'Cruzeiro do Sul',
  'Epitaciolândia',
  'Feijó',
  'Jordão',
  'Mâncio Lima',
  'Manoel Urbano',
  'Marechal Thaumaturgo',
  'Plácido de Castro',
  'Porto Acre',
  'Porto Walter',
  'Rio Branco',
  'Rodrigues Alves',
  'Santa Rosa do Purus',
  'Senador Guiomard',
  'Sena Madureira',
  'Tarauacá',
  'Xapuri',
  'Fora do estado',
] as const;

export type AcreMunicipalityOption = (typeof ACRE_MUNICIPALITY_OPTIONS)[number];

const municipalitySet = new Set<string>(ACRE_MUNICIPALITY_OPTIONS);

export function isAcreMunicipalityOption(value: string): value is AcreMunicipalityOption {
  return municipalitySet.has(value);
}

export function normalizeMunicipality(value: string | undefined): '' | AcreMunicipalityOption {
  if (!value) return '';
  return isAcreMunicipalityOption(value) ? value : '';
}

export function parseMunicipalitySelection(value: string | undefined): AcreMunicipalityOption[] {
  if (!value) return [];
  return value
    .split(',')
    .map((municipality) => municipality.trim())
    .filter(isAcreMunicipalityOption);
}

export function normalizeMunicipalitySelection(value: string | undefined): string {
  return parseMunicipalitySelection(value).join(', ');
}

export function isValidMunicipalitySelection(value: string): boolean {
  if (!value.trim()) return false;
  const entries = value.split(',').map((municipality) => municipality.trim());
  return entries.length > 0 && entries.every(isAcreMunicipalityOption);
}

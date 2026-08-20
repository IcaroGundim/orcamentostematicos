// Fontes ou Destinações de Recursos, POR EXERCÍCIO.
// Origem: "Anexo das Fontes ou Destinações de Recursos" — SEPLAN/DIRPLA/DEPOP.
//
// Os códigos podem mudar de um exercício para outro, então cada ano é registrado
// EXPLICITAMENTE em `CATALOGOS_POR_EXERCICIO`. Um exercício não registrado NÃO cai
// no catálogo de outro ano: isso produziria rótulos errados (pior que ausentes) e a
// seção 12 do contrato de design proíbe "completar por chute". Código desconhecido
// aparece como "Fonte não catalogada".

/** Anexo comum a 2025 e 2026 — o mesmo documento vale para os dois exercícios. */
const FONTES_2025_2026: Readonly<Record<string, string>> = Object.freeze({
  '15000100': 'Recursos Próprios do Tesouro',
  '15001001': 'Recursos destinados à Manutenção e Desenvolvimento do Ensino (25%)',
  '15001002': 'Recursos destinados ao Desenvolvimento das Ações de Saúde (12%)',
  '15010100': 'Outras Restituições aos Poderes',
  '15010600': 'Recursos Ordinários Desvinculados - DRE',
  '15010700': 'Recursos Próprios da Administração Indireta - Recursos não vinculados',
  '15010701': 'Recursos do Cira - Não Vinculados',
  '15400300': 'Transferência do FUNDEB - Impostos e Transferências de Impostos',
  '15401070': 'Identificação do percentual aplicado no pagamento da remuneração dos profissionais da educação básica em efetivo exercício',
  '15420300': 'Transferência do FUNDEB - Complementação da União - VAAT',
  '15430300': 'Transferência do FUNDEB - Complementação da União - VAAR',
  '15460000': 'Transferências do Fundeb - Complementação da União - ETI',
  '15500102': 'Transferências do Salário-Educação',
  '15530200': 'Transferências de Recursos do FNDE referentes ao PNAT',
  '15700200': 'Transferências do Governo Federal-Convênios/Repasses Vinculados à Educação',
  '15703110': 'Emendas Parlamentares Individuais (Educação)',
  '15703120': 'Emendas Parlamentares de Bancada (Educação)',
  '15703130': 'Emendas Parlamentares de Comissão (Educação)',
  '15730100': 'Royalties do Petróleo e Gás Natural Vinculados à Educação (75%)',
  '16000400': 'SUS - Manutenção',
  '16003110': 'Emendas Parlamentares Individuais (Saúde)',
  '16003120': 'Emendas Parlamentares de Bancada (Saúde)',
  '16003130': 'Emendas Parlamentares de Comissão (Saúde)',
  '16003140': 'Emendas Parlamentares de Relator (Saúde)',
  '16010400': 'SUS - Investimentos',
  '16013110': 'Emendas Parlamentares Individuais (Saúde)',
  '16013120': 'Emendas Parlamentares de Bancada (Saúde)',
  '16013130': 'Emendas Parlamentares de Comissão (Saúde)',
  '16013140': 'Emendas Parlamentares de Relator (Saúde)',
  '16050400': 'Complementação Pagamento do Piso Salarial da Enfermagem',
  '16310200': 'Transferências do Governo Federal Referentes a Convênios e Instrumentos Congêneres',
  '16313110': 'Emendas Parlamentares Individuais (Saúde)',
  '16313120': 'Emendas Parlamentares de Bancada (Saúde)',
  '16313130': 'Emendas Parlamentares de Comissão (Saúde)',
  '16313140': 'Emendas Parlamentares de Relator (Saúde)',
  '16350100': 'Royalties do Petróleo e Gás Natural Vinculados à Saúde (25%)',
  '16360200': 'Outras Transferências de Convênios e Instrumentos Congêneres vinculados à Saúde',
  '16600200': 'Transferências de Recursos do Fundo Nacional de Assistência Social - FNAS',
  '16603110': 'Emendas Parlamentares Individuais (FNAS)',
  '16603120': 'Emendas Parlamentares de Bancada (FNAS)',
  '16650200': 'Transferências de Convênios e Outros Repasses Vinculados à Assistência Social',
  '16653110': 'Emendas Parlamentares Individuais (Assistência Social)',
  '16653120': 'Emendas Parlamentares de Bancada (Assistência Social)',
  '16653130': 'Emendas de Comissão (Assistência Social)',
  '17000200': 'Outras Transferências de Convênios ou Repasses da União',
  '17000221': 'Transferência da União - Defesa Civil',
  '17003110': 'Emendas Parlamentares Individuais (União)',
  '17003120': 'Emendas Parlamentares de Bancada (União)',
  '17003130': 'Emendas Parlamentares de Comissão (União)',
  '17003140': 'Emendas Parlamentares de Relator (União)',
  '17010200': 'Outras Transferências de Convênios ou Instrumentos Congêneres dos Estados',
  '17020200': 'Outras Transferências de Convênios ou Instrumentos Congêneres dos Municípios',
  '17030200': 'Contribuição financeira não reembolsável',
  '17030202': 'Fundo Amazônia',
  '17030203': 'PROCAPE / FOCEM',
  '17040704': 'Transferências da União referentes a Royalties do Petróleo e Gás Natural',
  '17063110': 'Transferência Especial da União',
  '17120700': 'Transferências Recursos Fundo Penitenciário - FUNPEM',
  '17130700': 'Transferência Fundo a Fundo de Recursos do Fundo de Segurança Pública - FSP',
  '17140200': 'Transferência Fundo a Fundo-Recursos do FAT',
  '17150013': 'Transferência destinada ao Setor Cultural-Lc Nº195/2022-Art.5º Audiovisual',
  '17160013': 'Transferência ao Setor Cultural-Lc Nº195/2022-Art.8º- Demais setores',
  '17190013': 'Transferência Política Nacional de Fomento à Cultura-Lei Nº 14.399/2022',
  '17500101': 'Cide - Combustíveis',
  '17520700': 'Recursos Provenientes da Arrecadação de Multas de Trânsito',
  '17530700': 'Recursos Provenientes de Taxas e Contribuição e Preços Públicos',
  '17540500': 'Operações de Crédito',
  '17540501': 'Bird - Progestão',
  '17540502': 'Fundo Clima',
  '17550103': 'Alienação de Bens - Administração Direta',
  '17550700': 'Recursos de Alienação de Bens/Ativos - Administração Direta',
  '17560700': 'Recursos de Alienação de Bens/Ativos - Administração Indireta',
  '17570000': 'Recursos de Depósitos Judiciais - Lides das quais o Ente faz parte',
  '17600700': 'Recursos de Emolumentos, Taxas e Custas',
  '18001111': 'Benefícios Previdenciários - Poder Executivo - Fundo em Capitalização (Plano Previdenciário)',
  '18001121': 'Recursos do RPPS - Fundo em Capitalização (Plano Previdenciário) - Poder Executivo',
  '18001122': 'Recursos do RPPS - Fundo em Capitalização (Plano Previdenciário) - Tribunal de Contas',
  '18001131': 'Recursos do RPPS - Fundo em Capitalização (Plano Previdenciário) - Tribunal de Contas',
  '18001141': 'Recursos do RPPS - Fundo em Capitalização (Plano Previdenciário) - Ministério Público',
  '18001151': 'Recursos do RPPS - Fundo em Capitalização (Plano Previdenciário) - Defensoria Pública',
  '18010000': 'Recursos do RPPS - Fundo em Repartição (Plano Financeiro)',
  '18012111': 'Benefícios Previdenciários - Poder Executivo - Fundo em Repartição (Plano Financeiro)',
  '18020000': 'Recursos Vinculados ao RPPS - Taxa de Administração',
  '18032211': 'Benefícios Previdenciários - Militares SPSM',
});

/**
 * Catálogos por exercício. Para adicionar um ano, inclua o anexo oficial daquele
 * exercício aqui — nunca reaproveitando o de outro ano.
 */
const CATALOGOS_POR_EXERCICIO: Readonly<Record<number, Readonly<Record<string, string>>>> =
  Object.freeze({
    // 2025 e 2026 compartilham o anexo: confirmado com a SEPLAN que o documento não
    // mudou entre os dois exercícios. Cada ano segue registrado um a um — apontar
    // para o mesmo objeto é uma constatação, não uma herança automática.
    2025: FONTES_2025_2026,
    2026: FONTES_2025_2026,
  });

/** Exercícios com catálogo de fontes disponível. */
export function exerciciosComCatalogoDeFontes(): number[] {
  return Object.keys(CATALOGOS_POR_EXERCICIO).map(Number).sort((a, b) => b - a);
}

/**
 * Sufixo por grupo de fonte — o primeiro dígito do código (Portaria STN).
 *
 * A destinação do recurso é dada pelos 7 dígitos seguintes; o primeiro diz apenas de
 * qual exercício o dinheiro vem. Por isso `27130700` é a mesma destinação de
 * `17130700` (FSP), só que custeada por superávit de exercícios anteriores.
 */
const GRUPO_FONTE_SUFIXO: Readonly<Record<string, string>> = Object.freeze({
  '2': 'superávit de exercícios anteriores',
  '3': 'recursos condicionados',
});

/**
 * Rótulo da fonte de recurso.
 *
 * Além da consulta direta, deriva os grupos 2 e 3 a partir da fonte equivalente do
 * exercício corrente (grupo 1). Sem isso, 33 das 40 fontes não catalogadas do QDD
 * vigente apareciam como "Fonte não catalogada" mesmo tendo destinação conhecida —
 * e cada nova fonte de superávit exigiria uma entrada manual no catálogo.
 */
export function getFonteLabel(
  code: string | null | undefined,
  year: number | null | undefined,
): string | undefined {
  if (!code || year == null) return undefined;
  const catalogo = CATALOGOS_POR_EXERCICIO[year];
  if (!catalogo) return undefined;

  const key = code.replace(/\D/g, '');

  const direct = catalogo[key];
  if (direct) return direct;

  const sufixo = GRUPO_FONTE_SUFIXO[key[0] ?? ''];
  if (sufixo && key.length === 8) {
    // A derivação resolve DENTRO do catálogo do mesmo exercício.
    const base = catalogo[`1${key.slice(1)}`];
    if (base) return `${base} — ${sufixo}`;
  }

  return undefined;
}

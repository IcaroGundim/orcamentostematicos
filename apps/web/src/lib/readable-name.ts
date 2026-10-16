/**
 * Nome do QDD em caixa normal, para leitura: "SECRETARIA DE ESTADO DE EDUCAÇÃO E
 * ESPORTE - SEE" vira "Secretaria de Estado de Educação e Esporte (SEE)".
 *
 * Só para exibição. Busca, exportação e chaves continuam sobre o texto original —
 * esta é uma heurística (lista de siglas feita à mão) e erra em nome que ela não
 * conhece; o erro tem de ficar restrito ao que a tela mostra.
 */

/** Palavras que ficam em minúsculas no meio do nome. */
const MINOR_WORDS = new Set([
  'a', 'à', 'ao', 'aos', 'as', 'às', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'para', 'pela', 'pelo', 'por',
]);

/**
 * Siglas que aparecem no meio dos nomes e precisam continuar em caixa alta. As
 * siglas de órgão no fim do nome (" - SEE") são detectadas pela posição e não
 * precisam estar aqui.
 */
const ACRONYMS = new Set([
  'AC', 'ALEAC', 'CASMIL', 'CEPDEC', 'DPE', 'FEM', 'FUNCULTURA', 'FUNDEB', 'FUNDES',
  'GABVICE', 'ICMS', 'IEPTEC', 'IPVA', 'MPAC', 'PCAC', 'PMAC', 'REPAC', 'RPPS', 'SEAD',
  'SECC', 'SEE', 'SEGOV', 'SEMA', 'SEPLAN', 'SESACRE', 'SPSM', 'SUS', 'TCE', 'TJ',
  'TJAC', 'TI', 'EJA', 'UPA', 'SAMU', 'PNAE', 'IDAF', 'DETRAN', 'DERACRE', 'IMAC',
  'ISE', 'IAPEN', 'PROCON', 'FUNTAC', 'IDM', 'BID', 'BNDES', 'PPA',
  'LOA', 'LDO', 'II', 'III', 'IV',
]);

/** Sufixo de sigla no fim do nome: " - SEE", " - SESACRE". */
const MAX_TAIL_ACRONYM = 12;

function isAcronymTail(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_TAIL_ACRONYM &&
    value === value.toUpperCase() &&
    /^[A-ZÀ-Ú0-9/]+$/.test(value)
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function readableWord(word: string, isFirst: boolean): string {
  return word
    .split('-')
    .map((part, index) => {
      const bare = part.toUpperCase().replace(/[^A-ZÀ-Ú]/g, '');
      if (bare && ACRONYMS.has(bare)) return part.toUpperCase();
      if ((!isFirst || index > 0) && MINOR_WORDS.has(part)) return part;
      if (part.startsWith('(')) return `(${capitalize(part.slice(1))}`;
      return capitalize(part);
    })
    .join('-');
}

export function readableName(name: string | null | undefined): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  // Texto que já vem em caixa mista foi escrito à mão: não mexer.
  if (raw !== raw.toUpperCase()) return raw;

  const fixed = raw
    // Quebras de linha herdadas do cadastro: "ESPOR- TE", "AMBIEN TE", "DESENVOLVI - MENTO".
    .replace(/DESENVOLVI\s*-\s*MENTO/g, 'DESENVOLVIMENTO')
    .replace(/AMBIEN TE/g, 'AMBIENTE')
    .replace(/([A-ZÀ-Ú])- ([A-ZÀ-Ú])/g, '$1$2')
    .replace(/\.(?=[A-ZÀ-Ú])/g, '. ')
    .replace(/([A-ZÀ-Ú])\(/g, '$1 (')
    .replace(/\s+/g, ' ');
  const parts = fixed.split(' - ');
  const tail = parts.length > 1 && isAcronymTail(parts[parts.length - 1]!.trim())
    ? parts.pop()!.trim()
    : null;

  const body = parts
    .join(' – ')
    .toLowerCase()
    .split(' ')
    .map((word, index) => readableWord(word, index === 0))
    .join(' ')
    .replace(/\.$/, '');

  return tail ? `${body} (${tail})` : body;
}

/** Tira o prefixo de código dos rótulos agregados: "3.3.90.39 — Serviços…" → "Serviços…". */
export function withoutCode(label: string): string {
  return label.replace(/^\S+ — /, '');
}

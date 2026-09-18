/**
 * Deriva a escala de quatro tons da marca a partir de UMA cor.
 *
 * Existe porque escolher a cor da identidade não é escolher um hex: a aplicação
 * precisa de quatro papéis que não são intercambiáveis (ver `globals.css` e a
 * seção 4.1 de `docs/design-orcamento.md`). A primeira tentativa de trocar o
 * verde por `#78a890` ia sair com texto branco a 2,7:1, reprovando no WCAG AA —
 * esta função existe para que esse erro não dependa de alguém lembrar de medir.
 *
 * Toda decisão aqui é verificável: cada tom vem acompanhado do contraste que o
 * justifica, e o que não alcança o mínimo vira aviso explícito em vez de passar
 * calado.
 */

/** Mínimo do WCAG AA para texto normal. */
export const AA_TEXTO = 4.5;

/**
 * Alvo de contraste do tom escuro, acima do mínimo de propósito.
 *
 * Ele serve a DOIS papéis com a mesma razão: texto escuro sobre branco e texto
 * branco sobre ele. Parar no primeiro valor que cruza 4,5:1 entrega uma cor que
 * passa por um fio nos dois — e some contra a marca. O tom escolhido à mão para
 * o verde (`#3f6252`) marcava 6,82:1; 6,5 é o alvo que reproduz esse conforto.
 */
export const ALVO_TOM_ESCURO = 6.5;

/**
 * Distância mínima de luminosidade OKLCH entre `marca` e `marca-escura`.
 *
 * Sem isto, uma cor de meia-luz (`#606078`, por exemplo) já passa sozinha no
 * contraste sobre branco, e o tom escuro sairia idêntico à própria marca — o
 * tooltip escuro ficaria indistinguível do cabeçalho de painel. 0,12 é o menor
 * passo em que os dois ainda se separam a olho.
 */
export const SEPARACAO_MINIMA_L = 0.12;

const PRETO_DA_PALETA = '#110f24';
const BRANCO_DA_PALETA = '#fcfcfc';

export type Oklch = { L: number; C: number; H: number };

export type Tom = {
  hex: string;
  oklch: Oklch;
  /** Valor pronto para colar no CSS, no formato que `globals.css` já usa. */
  css: string;
};

export type Medida = {
  rotulo: string;
  valor: number;
  minimo: number;
  passa: boolean;
};

export type Paleta = {
  marca: Tom;
  marcaHover: Tom;
  marcaEscura: Tom;
  marcaContraste: Tom;
  medidas: Medida[];
  /** Distância de luminosidade OKLCH entre `marca` e `marca-escura`. */
  separacaoL: number;
  avisos: string[];
};

/* ── Conversões ──────────────────────────────────────────────────────────── */

export function normalizarHex(entrada: string): string | null {
  const t = entrada.trim().replace(/^#/, '');
  const expandido = t.length === 3 ? t.split('').map((c) => c + c).join('') : t;
  return /^[0-9a-fA-F]{6}$/.test(expandido) ? `#${expandido.toLowerCase()}` : null;
}

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function rgbParaHex(r: number, g: number, b: number): string {
  const canal = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

const paraLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const paraGama = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** Luminância relativa do WCAG. */
export function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map(paraLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste do WCAG entre duas cores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

export function hexParaOklch(hex: string): Oklch {
  const [r, g, b] = hexParaRgb(hex).map(paraLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return { L, C: Math.hypot(A, B), H: H < 0 ? H + 360 : H };
}

export function oklchParaHex({ L, C, H }: Oklch): string {
  const rad = (H * Math.PI) / 180;
  const A = C * Math.cos(rad);
  const B = C * Math.sin(rad);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  // Fora do gamut sRGB o valor é grampeado em rgbParaHex — aceitável para uma
  // paleta de interface, que não navega pelas bordas do espaço de cor.
  return rgbParaHex(
    paraGama(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    paraGama(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    paraGama(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
}

function tom(oklch: Oklch): Tom {
  const hex = oklchParaHex(oklch);
  // Reconverte a partir do hex grampeado: é a cor que o navegador vai pintar de
  // fato, então é ela que precisa aparecer no CSS e nas medidas de contraste.
  const real = hexParaOklch(hex);
  return {
    hex,
    oklch: real,
    css: `oklch(${real.L.toFixed(3)} ${real.C.toFixed(3)} ${real.H.toFixed(1)})`,
  };
}

/* ── Derivação ───────────────────────────────────────────────────────────── */

/** Procura, variando só a luminosidade, o primeiro tom que satisfaz `aceita`. */
function buscarPorLuminosidade(
  base: Oklch,
  direcao: 1 | -1,
  aceita: (hex: string, L: number) => boolean,
): Oklch | null {
  for (let passo = 1; passo <= 100; passo += 1) {
    const L = base.L + direcao * passo * 0.01;
    if (L <= 0.02 || L >= 0.99) break;
    const candidato = { ...base, L };
    if (aceita(oklchParaHex(candidato), L)) return candidato;
  }
  return null;
}

/**
 * Deriva os quatro tons a partir da cor pedida.
 *
 * - `marca` é exatamente a cor informada; ela manda nas superfícies.
 * - `marca-contraste` é o preto ou o branco da paleta — o que enxergar melhor
 *   sobre a marca.
 * - `marca-escura` precisa servir a texto sobre fundo BRANCO, então persegue
 *   4,5:1 contra branco puro, e ainda se afasta da marca em luminosidade para os
 *   dois papéis não colapsarem num tom só.
 * - `marca-hover` escurece a superfície sem perder o texto que pousa nela. A
 *   direção da busca vem de quem ganhou o contraste: com texto branco (marca
 *   escura) escurecer sempre ajuda; com texto preto (marca clara) escurecer
 *   consome margem, e pode ser preciso clarear.
 */
export function derivarPaleta(hexEntrada: string): Paleta | null {
  const hex = normalizarHex(hexEntrada);
  if (!hex) return null;

  const base = hexParaOklch(hex);
  const marca = tom(base);
  const avisos: string[] = [];

  const contrastePreto = contraste(marca.hex, PRETO_DA_PALETA);
  const contrasteBranco = contraste(marca.hex, BRANCO_DA_PALETA);
  const usaTextoPreto = contrastePreto >= contrasteBranco;
  const marcaContraste = tom(hexParaOklch(usaTextoPreto ? PRETO_DA_PALETA : BRANCO_DA_PALETA));
  const contrasteDoTexto = Math.max(contrastePreto, contrasteBranco);

  if (contrasteDoTexto < AA_TEXTO) {
    avisos.push(
      `Nenhum texto alcança 4,5:1 sobre ${marca.hex} — o melhor caso é ` +
        `${contrasteDoTexto.toFixed(2)}:1, com ${usaTextoPreto ? 'preto' : 'branco'}. ` +
        'Cabeçalhos e faixas ficariam ilegíveis; escureça ou clareie a cor.',
    );
  }

  // ── marca-escura: texto sobre branco, bordas, superfície com texto branco ──
  const serveComoEscura = (candHex: string, L: number) =>
    contraste(candHex, '#ffffff') >= ALVO_TOM_ESCURO && base.L - L >= SEPARACAO_MINIMA_L;

  let escuraOklch = buscarPorLuminosidade(base, -1, serveComoEscura);
  if (!escuraOklch) {
    // Alvo confortável fora de alcance: cai para o mínimo do AA, e só avisa se
    // nem isso couber junto com a separação.
    escuraOklch = buscarPorLuminosidade(
      base,
      -1,
      (c, L) => contraste(c, '#ffffff') >= AA_TEXTO && base.L - L >= SEPARACAO_MINIMA_L,
    );
    if (!escuraOklch) {
      escuraOklch =
        buscarPorLuminosidade(base, -1, (c) => contraste(c, '#ffffff') >= AA_TEXTO) ?? {
          ...base,
          L: Math.max(0.05, base.L - SEPARACAO_MINIMA_L),
        };
      avisos.push(
        'Não foi possível separar o tom escuro da marca em luminosidade mantendo ' +
          '4,5:1 sobre branco. Os dois papéis vão parecer a mesma cor — o tooltip ' +
          'escuro ficará indistinguível do cabeçalho de painel.',
      );
    }
  }
  const marcaEscura = tom(escuraOklch);

  // ── marca-hover: escurece a superfície sem perder o texto que pousa nela ──
  const serveComoHover = (candHex: string) => contraste(candHex, marcaContraste.hex) >= AA_TEXTO;
  const distante = (L: number) => Math.abs(L - base.L) >= 0.03;

  let hoverOklch =
    buscarPorLuminosidade(base, -1, (c, L) => serveComoHover(c) && distante(L)) ??
    buscarPorLuminosidade(base, 1, (c, L) => serveComoHover(c) && distante(L));

  if (!hoverOklch) {
    hoverOklch = { ...base, L: Math.max(0.03, base.L - 0.05) };
    avisos.push(
      'O estado de hover não consegue escurecer nem clarear sem o texto cair ' +
        'abaixo de 4,5:1. O valor abaixo é o melhor possível, mas confira na tela.',
    );
  }
  const marcaHover = tom(hoverOklch);

  const medidas: Medida[] = [
    {
      rotulo: 'texto sobre a marca',
      valor: contraste(marcaContraste.hex, marca.hex),
      minimo: AA_TEXTO,
      passa: contraste(marcaContraste.hex, marca.hex) >= AA_TEXTO,
    },
    {
      rotulo: 'texto sobre o hover',
      valor: contraste(marcaContraste.hex, marcaHover.hex),
      minimo: AA_TEXTO,
      passa: contraste(marcaContraste.hex, marcaHover.hex) >= AA_TEXTO,
    },
    {
      rotulo: 'tom escuro sobre branco',
      valor: contraste(marcaEscura.hex, '#ffffff'),
      minimo: AA_TEXTO,
      passa: contraste(marcaEscura.hex, '#ffffff') >= AA_TEXTO,
    },
    {
      rotulo: 'branco sobre o tom escuro',
      valor: contraste('#ffffff', marcaEscura.hex),
      minimo: AA_TEXTO,
      passa: contraste('#ffffff', marcaEscura.hex) >= AA_TEXTO,
    },
  ];

  // Distância visual entre a marca e o tom escuro. Não é razão de contraste — é
  // o que impede os dois papéis de virarem a mesma cor na tela.
  const separacaoL = marca.oklch.L - marcaEscura.oklch.L;

  return { marca, marcaHover, marcaEscura, marcaContraste, medidas, separacaoL, avisos };
}

/** Bloco pronto para substituir os quatro tokens em `globals.css`. */
export function blocoCss(p: Paleta): string {
  return [
    `  --marca: ${p.marca.css};`,
    `  --marca-hover: ${p.marcaHover.css};`,
    `  --marca-escura: ${p.marcaEscura.css};`,
    `  --marca-contraste: ${p.marcaContraste.css};`,
  ].join('\n');
}

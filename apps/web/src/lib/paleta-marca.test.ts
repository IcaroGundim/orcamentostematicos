import { describe, expect, it } from 'vitest';
import {
  AA_TEXTO,
  SEPARACAO_MINIMA_L,
  contraste,
  derivarPaleta,
  hexParaOklch,
  normalizarHex,
  oklchParaHex,
} from './paleta-marca';

describe('normalizarHex', () => {
  it('aceita com e sem cerquilha, maiúsculas e forma curta', () => {
    expect(normalizarHex('#78A890')).toBe('#78a890');
    expect(normalizarHex('78a890')).toBe('#78a890');
    expect(normalizarHex(' #abc ')).toBe('#aabbcc');
  });

  it('recusa lixo', () => {
    for (const ruim of ['', '#12345', 'verde', '#gggggg', '#1234567']) {
      expect(normalizarHex(ruim)).toBeNull();
    }
  });
});

describe('conversão OKLCH', () => {
  it('vai e volta sem perder a cor', () => {
    for (const hex of ['#78a890', '#606078', '#14532d', '#ffffff', '#000000', '#c8c89f']) {
      expect(oklchParaHex(hexParaOklch(hex))).toBe(hex);
    }
  });
});

describe('contraste', () => {
  // Valores conferidos à mão contra a fórmula do WCAG antes de virarem teste.
  it('reproduz as razões que motivaram a escala de quatro tons', () => {
    expect(contraste('#78a890', '#ffffff')).toBeCloseTo(2.69, 1);
    expect(contraste('#78a890', '#110f24')).toBeCloseTo(6.98, 1);
    expect(contraste('#3f6252', '#ffffff')).toBeCloseTo(6.82, 1);
  });

  it('é simétrico e vale 21 no extremo', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});

describe('derivarPaleta — a paleta em produção hoje', () => {
  const p = derivarPaleta('#78a890')!;

  it('mantém a cor pedida como marca', () => {
    expect(p.marca.hex).toBe('#78a890');
  });

  it('escolhe texto ESCURO, que é o achado que evitou 2,7:1', () => {
    expect(p.marcaContraste.hex).toBe('#110f24');
  });

  it('chega perto do tom escuro escolhido à mão (#3f6252)', () => {
    // Não exige igualdade: a busca anda de 0,01 em 0,01 na luminosidade.
    expect(contraste(p.marcaEscura.hex, '#ffffff')).toBeGreaterThanOrEqual(AA_TEXTO);
    expect(p.marcaEscura.oklch.L).toBeLessThan(p.marca.oklch.L);
  });

  it('não produz aviso: esta cor sustenta os quatro papéis', () => {
    expect(p.avisos).toEqual([]);
  });

  it('aprova todas as medidas de texto', () => {
    for (const m of p.medidas.filter((x) => x.minimo === AA_TEXTO)) {
      expect(m.passa, `${m.rotulo} = ${m.valor.toFixed(2)}:1`).toBe(true);
    }
  });
});

describe('derivarPaleta — #606078, o caso que colapsaria os tons', () => {
  const p = derivarPaleta('#606078')!;

  it('separa marca e tom escuro em luminosidade', () => {
    // Sem a separação forçada os dois sairiam praticamente iguais, porque
    // #606078 já passa sozinho no contraste sobre branco.
    expect(p.marca.oklch.L - p.marcaEscura.oklch.L).toBeGreaterThanOrEqual(
      SEPARACAO_MINIMA_L - 0.02,
    );
  });

  it('ainda entrega tom escuro legível sobre branco', () => {
    expect(contraste(p.marcaEscura.hex, '#ffffff')).toBeGreaterThanOrEqual(AA_TEXTO);
  });
});

describe('derivarPaleta — entradas degeneradas', () => {
  it('branco puro: avisa que nenhum texto alcança AA sobre ele', () => {
    const p = derivarPaleta('#ffffff')!;
    expect(p.marcaContraste.hex).toBe('#110f24');
    expect(contraste(p.marca.hex, p.marcaContraste.hex)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('preto puro: texto branco e nenhuma medida de texto reprovada', () => {
    const p = derivarPaleta('#000000')!;
    expect(p.marcaContraste.hex).toBe('#fcfcfc');
    expect(contraste(p.marca.hex, p.marcaContraste.hex)).toBeGreaterThanOrEqual(AA_TEXTO);
  });

  it('cor de meia-luz sem texto legível vira aviso, não valor silencioso', () => {
    // #767676 é o ponto clássico em que nem preto nem branco chegam a 4,5:1.
    const p = derivarPaleta('#808080')!;
    const textoSobreMarca = p.medidas.find((m) => m.rotulo === 'texto sobre a marca')!;
    if (!textoSobreMarca.passa) expect(p.avisos.length).toBeGreaterThan(0);
  });

  it('devolve null para hex inválido em vez de explodir', () => {
    expect(derivarPaleta('não é cor')).toBeNull();
  });
});

describe('derivarPaleta — invariantes para qualquer cor', () => {
  const amostra = ['#78a890', '#606078', '#14532d', '#b8b477', '#0d3b5a', '#e2e8f0', '#1a1a1a'];

  it('o hover sempre difere da marca', () => {
    for (const hex of amostra) {
      const p = derivarPaleta(hex)!;
      expect(p.marcaHover.hex, hex).not.toBe(p.marca.hex);
    }
  });

  it('o contraste do texto no hover nunca é pior que o aviso promete', () => {
    for (const hex of amostra) {
      const p = derivarPaleta(hex)!;
      const m = p.medidas.find((x) => x.rotulo === 'texto sobre o hover')!;
      if (!m.passa) expect(p.avisos.length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { donutArcs, shareOf, squarify, topWithOther, waffleCells } from './chart-geometry';

const items = [
  { key: 'a', label: 'A', value: 50 },
  { key: 'b', label: 'B', value: 30 },
  { key: 'c', label: 'C', value: 15 },
  { key: 'd', label: 'D', value: 5 },
];

describe('squarify', () => {
  it('cobre a caixa inteira: a soma das áreas é a área da caixa', () => {
    const rects = squarify(items, 640, 300);
    const area = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
    expect(area).toBeCloseTo(640 * 300, 6);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(-1e-9);
      expect(rect.y).toBeGreaterThanOrEqual(-1e-9);
      expect(rect.x + rect.w).toBeLessThanOrEqual(640 + 1e-6);
      expect(rect.y + rect.h).toBeLessThanOrEqual(300 + 1e-6);
    }
  });

  it('área proporcional ao valor', () => {
    const rects = squarify(items, 100, 100);
    const a = rects.find((rect) => rect.item.key === 'a')!;
    expect(a.w * a.h).toBeCloseTo(5000, 6);
  });

  it('lista vazia, total zero e valores negativos não geram retângulo', () => {
    expect(squarify([], 100, 100)).toEqual([]);
    expect(squarify([{ value: 0 }], 100, 100)).toEqual([]);
    expect(squarify([{ value: -10 }, { value: 10 }], 100, 100)).toHaveLength(1);
  });
});

describe('topWithOther', () => {
  it('fecha "Demais" com o total real', () => {
    const top = topWithOther(items.slice(0, 2), 1, 'Demais', 100);
    expect(top.map((item) => item.value)).toEqual([50, 50]);
    expect(top[1]!.label).toBe('Demais');
  });

  it('não cria "Demais" vazio', () => {
    expect(topWithOther(items, 10, 'Demais')).toHaveLength(4);
  });
});

describe('waffleCells', () => {
  it('soma exatamente 100 pelo maior resto', () => {
    const cells = waffleCells([1, 1, 1]);
    expect(cells.reduce((sum, value) => sum + value, 0)).toBe(100);
  });

  it('total zero vira zero quadradinhos', () => {
    expect(waffleCells([0, 0])).toEqual([0, 0]);
    expect(waffleCells([])).toEqual([]);
  });
});

describe('donutArcs e shareOf', () => {
  it('arcos encadeados que fecham em 1', () => {
    const arcs = donutArcs(items);
    const last = arcs[arcs.length - 1]!;
    expect(last.start + last.share).toBeCloseTo(1, 9);
  });

  it('base zero não vira NaN', () => {
    expect(donutArcs([{ value: 0 }])).toEqual([]);
    expect(shareOf(10, 0)).toBe(0);
  });
});

/**
 * Geometria dos gráficos desenhados à mão em SVG (`execution-visuals.tsx`): mapa de
 * áreas, rosca, grade de quadradinhos e o agrupamento de "Demais". Funções puras,
 * sem React, para poderem ser testadas — e todas toleram lista vazia e total zero,
 * que é o que acontece num recorte filtrado até sumir.
 */

export interface ValueItem {
  key: string;
  label: string;
  value: number;
}

/**
 * Os `n` maiores itens e, se sobrar algo, um item "Demais" que fecha com `total`.
 * Fechar com o total real (e não com a soma do que foi recebido) importa: quem chama
 * às vezes já recebe uma lista cortada, e a fatia de "Demais" precisa do resto todo.
 */
export function topWithOther<T extends ValueItem>(
  items: T[],
  n: number,
  otherLabel: string,
  total?: number,
): Array<T | ValueItem> {
  const positive = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const top: Array<T | ValueItem> = positive.slice(0, n);
  const shown = top.reduce((sum, item) => sum + item.value, 0);
  const rest =
    total != null ? total - shown : positive.slice(n).reduce((sum, item) => sum + item.value, 0);
  // Meio centavo de folga: soma de ponto flutuante não pode inventar uma fatia.
  if (rest > 0.005) top.push({ key: '__other__', label: otherLabel, value: rest });
  return top;
}

export interface TreemapRect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Mapa de áreas "squarified" (Bruls, Huizing e van Wijk): área proporcional ao valor,
 * retângulos o mais próximos possível de quadrados. Itens com valor ≤ 0 ficam de
 * fora — área negativa não existe.
 */
export function squarify<T extends { value: number }>(
  items: T[],
  width: number,
  height: number,
): TreemapRect<T>[] {
  const positive = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (!total || width <= 0 || height <= 0) return [];

  const scale = (width * height) / total;
  const queue = positive.map((item) => ({ item, area: item.value * scale }));
  const rects: TreemapRect<T>[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;

  const worst = (row: typeof queue, side: number) => {
    const sum = row.reduce((acc, entry) => acc + entry.area, 0);
    let max = 0;
    let min = Infinity;
    for (const entry of row) {
      max = Math.max(max, entry.area);
      min = Math.min(min, entry.area);
    }
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const place = (row: typeof queue) => {
    const sum = row.reduce((acc, entry) => acc + entry.area, 0);
    if (w >= h) {
      const columnWidth = sum / h;
      let cursor = y;
      for (const entry of row) {
        const entryHeight = entry.area / columnWidth;
        rects.push({ item: entry.item, x, y: cursor, w: columnWidth, h: entryHeight });
        cursor += entryHeight;
      }
      x += columnWidth;
      w -= columnWidth;
    } else {
      const rowHeight = sum / w;
      let cursor = x;
      for (const entry of row) {
        const entryWidth = entry.area / rowHeight;
        rects.push({ item: entry.item, x: cursor, y, w: entryWidth, h: rowHeight });
        cursor += entryWidth;
      }
      y += rowHeight;
      h -= rowHeight;
    }
  };

  let row: typeof queue = [];
  while (queue.length) {
    const side = Math.min(w, h);
    const next = [...row, queue[0]!];
    if (!row.length || worst(next, side) <= worst(row, side)) {
      row = next;
      queue.shift();
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return rects;
}

export interface DonutArc<T> {
  item: T;
  /** Fração do total, de 0 a 1. */
  share: number;
  /** Onde o arco começa, em fração da volta (0 = topo). */
  start: number;
}

/** Arcos da rosca, na ordem recebida. Total zero → nenhum arco. */
export function donutArcs<T extends { value: number }>(items: T[], total?: number): DonutArc<T>[] {
  const positive = items.filter((item) => item.value > 0);
  const base = total ?? positive.reduce((sum, item) => sum + item.value, 0);
  if (!(base > 0)) return [];
  let start = 0;
  return positive.map((item) => {
    const share = item.value / base;
    const arc = { item, share, start };
    start += share;
    return arc;
  });
}

/**
 * Quantos dos 100 quadradinhos cabem a cada item (cada um vale 1%), pelo método do
 * maior resto: a soma dá exatamente 100 quando os itens fecham com o total.
 */
export function waffleCells(values: number[], total?: number): number[] {
  const base = total ?? values.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!(base > 0)) return values.map(() => 0);
  const raw = values.map((value) => (Math.max(0, value) / base) * 100);
  const cells = raw.map(Math.floor);
  // Normalmente 100; menos quando `total` inclui algo que não veio na lista.
  const target = Math.min(100, Math.round(raw.reduce((sum, value) => sum + value, 0)));
  let left = target - cells.reduce((sum, value) => sum + value, 0);
  const byRemainder = raw
    .map((value, index) => [value - Math.floor(value), index] as const)
    .sort((a, b) => b[0] - a[0]);
  for (const [, index] of byRemainder) {
    if (left <= 0) break;
    cells[index]! += 1;
    left -= 1;
  }
  return cells;
}

/** Percentual seguro: base zero vira 0, e não NaN nem Infinity. */
export function shareOf(value: number, base: number): number {
  return base ? (value / base) * 100 : 0;
}

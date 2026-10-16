/**
 * Chave lógica das ações orçamentárias. Fica fora de `qdd-parser` de propósito: o
 * parser importa o SheetJS (centenas de KB), e a chave é usada por `store`,
 * `government-structure` e `qdd-replacement`, que a maioria das rotas de API carrega.
 * `qdd-parser` continua reexportando estes nomes.
 */

export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Chave lógica estável de uma ação orçamentária, idêntica à usada na agregação
 * de linhas em `parseQdd`. Identifica a "mesma" ação entre versões de QDD mesmo
 * quando o `id` (aleatório) muda a cada importação.
 */
export function actionLogicalKey(a: {
  year: number; organizationCode: string; unitCode: string;
  projectActivity: string; application: string;
}) {
  return [a.year, a.organizationCode, a.unitCode, a.projectActivity, normalize(a.application)].join('|');
}

'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Nome do parâmetro na URL. A API usa `year`; a URL fica em pt-BR. */
export const EXERCISE_PARAM = 'exercicio';

/**
 * Exercício financeiro selecionado, guardado na URL (`?exercicio=2026`).
 *
 * A URL é a fonte da verdade porque o estado é global entre módulos, sobrevive a
 * um F5 e torna a tela compartilhável — sem introduzir um provider novo numa árvore
 * que hoje não tem nenhum estado global.
 *
 * `year` é `null` até o `currentYear` chegar do `/api/metadata`; nesse intervalo as
 * chamadas seguem sem o parâmetro e o servidor resolve o exercício corrente.
 */
export function useExercise(currentYear?: number | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Exercício pedido na URL, ou `null` quando ausente. É ESTE valor que deve
   * governar a carga de dados: ele não muda quando o `currentYear` chega do
   * `/api/metadata`, e por isso a página faz uma única requisição por montagem.
   * Usar o ano já resolvido aqui dispararia uma segunda carga completa do QDD
   * (milhares de ações com `expenseLines`) assim que o metadata respondesse.
   */
  const requestedYear = useMemo(() => {
    const raw = searchParams.get(EXERCISE_PARAM);
    if (raw == null || raw === '') return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : null;
  }, [searchParams]);

  /** Exercício para exibição enquanto o servidor não responde qual foi carregado. */
  const year = requestedYear ?? currentYear ?? null;

  const setYear = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      // O exercício corrente não suja a URL: fica implícito, como antes.
      if (currentYear != null && next === currentYear) params.delete(EXERCISE_PARAM);
      else params.set(EXERCISE_PARAM, String(next));
      const query = params.toString();
      // `replace` para a troca de exercício não empilhar histórico a cada clique.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, currentYear],
  );

  return { requestedYear, year, setYear };
}

/** Sufixo `?year=` para as chamadas de API; vazio quando o exercício ainda não resolveu. */
export function exerciseQuery(year: number | null | undefined, separator: '?' | '&' = '?') {
  return year == null ? '' : `${separator}year=${year}`;
}

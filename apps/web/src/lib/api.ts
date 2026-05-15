import type { User } from '@/types/domain';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Session {
  token: string;
  user: User;
}

export function getStoredSession(): Session | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem('otac-session');
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function setStoredSession(session: Session) {
  window.localStorage.setItem('otac-session', JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem('otac-session');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getStoredSession();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.token) {
    headers.set('Authorization', `Bearer ${session.token}`);
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredSession();
      window.location.href = '/login';
      return new Promise<T>(() => {});
    }
    const message = await response.text();
    throw new Error(message || 'Erro ao acessar a API.');
  }
  return response.json() as Promise<T>;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export const themeLabels = {
  OCAD: 'OCAD',
  OSG: 'OSG',
  CLIMATICO: 'Climático',
};

export const statusLabels = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  DEVOLVIDO: 'Devolvido',
  APROVADO: 'Aprovado',
};

export const LEGISLATION_LINKS = [
  { label: 'OSG — Orçamento Sensível ao Gênero', url: 'https://seplan.ac.gov.br/planejamento-governamental/orcamentos-tematicos/relatorio-orcamento-sensivel-ao-genero-osg/' },
  { label: 'OCAD — Orçamento Criança e Adolescente', url: 'https://seplan.ac.gov.br/planejamento-governamental/orcamentos-tematicos/orcamento-crianca-e-adolescente-ocad/' },
  { label: 'Orçamento do Clima', url: 'https://seplan.ac.gov.br/planejamento-governamental/orcamentos-tematicos/orcamento-climatico-do-estado-do-acre/' },
] as const;

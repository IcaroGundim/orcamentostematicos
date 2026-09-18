import { describe, expect, it } from 'vitest';
import { SESSION_MAX_AGE_MS, isSessionExpired, sessionExpiryCutoff } from './session-lifetime';

const AGORA = new Date('2026-09-18T12:00:00Z');
const atras = (ms: number) => new Date(AGORA.getTime() - ms);

describe('isSessionExpired', () => {
  it('aceita sessão recém-criada', () => {
    expect(isSessionExpired(AGORA, AGORA)).toBe(false);
  });

  it('aceita sessão dentro da janela', () => {
    expect(isSessionExpired(atras(SESSION_MAX_AGE_MS - 1000), AGORA)).toBe(false);
  });

  it('recusa exatamente no limite', () => {
    // O limite é fechado: ao completar a idade máxima a sessão já não vale.
    expect(isSessionExpired(atras(SESSION_MAX_AGE_MS), AGORA)).toBe(true);
  });

  it('recusa sessão além da janela', () => {
    expect(isSessionExpired(atras(SESSION_MAX_AGE_MS + 1000), AGORA)).toBe(true);
  });

  it('recusa a sessão eterna que existia antes desta regra', () => {
    expect(isSessionExpired(new Date('2025-12-08T00:00:00Z'), AGORA)).toBe(true);
  });
});

describe('sessionExpiryCutoff', () => {
  it('marca o corte uma idade máxima atrás', () => {
    expect(sessionExpiryCutoff(AGORA).getTime()).toBe(AGORA.getTime() - SESSION_MAX_AGE_MS);
  });

  it('concorda com isSessionExpired nos dois lados do corte', () => {
    const corte = sessionExpiryCutoff(AGORA);
    // `deleteMany` usa `createdAt < corte`; `isSessionExpired` usa `>=` da idade.
    // As duas regras precisam classificar a mesma sessão do mesmo jeito, senão a
    // limpeza apagaria sessões ainda válidas — ou deixaria expiradas para trás.
    expect(isSessionExpired(new Date(corte.getTime() - 1), AGORA)).toBe(true);
    expect(isSessionExpired(new Date(corte.getTime() + 1), AGORA)).toBe(false);
  });
});

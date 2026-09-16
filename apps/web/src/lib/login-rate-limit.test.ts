import { describe, expect, it } from 'vitest';
import {
  LOGIN_WINDOW_MS,
  MAX_LOGIN_FAILURES,
  loginRateLimitKey,
  nextLoginFailure,
  retryAfterSeconds,
  type LoginFailureState,
} from './login-rate-limit';

describe('limite de login', () => {
  it('bloqueia na quinta falha por 5 minutos', () => {
    const now = new Date('2026-09-16T12:00:00Z');
    let state: LoginFailureState | null = null;
    for (let attempt = 1; attempt <= MAX_LOGIN_FAILURES; attempt++) {
      state = nextLoginFailure(state, now);
      expect(state.failures).toBe(attempt);
      expect(Boolean(state.blockedUntil)).toBe(attempt === MAX_LOGIN_FAILURES);
    }
    expect(retryAfterSeconds(state!.blockedUntil!, now)).toBe(300);
  });

  it('reinicia a contagem depois da janela', () => {
    const start = new Date('2026-09-16T12:00:00Z');
    const previous = nextLoginFailure(null, start);
    const next = nextLoginFailure(previous, new Date(start.getTime() + LOGIN_WINDOW_MS));
    expect(next.failures).toBe(1);
    expect(next.blockedUntil).toBeNull();
  });

  it('não grava o identificador em claro na chave', () => {
    const key = loginRateLimitKey('identifier', 'pessoa@example.com');
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain('pessoa');
  });
});

import { createHash } from 'node:crypto';

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_WINDOW_MS = 5 * 60 * 1000;

export type LoginFailureState = {
  failures: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export function loginRateLimitKey(kind: 'user' | 'identifier', value: string): string {
  return createHash('sha256').update(`${kind}:${value}`).digest('hex');
}

/** Identificador estável para serializar tentativas da mesma conta no PostgreSQL. */
export function loginRateLimitLockId(key: string): number {
  return Buffer.from(key, 'hex').readInt32BE(0);
}

export function nextLoginFailure(
  previous: LoginFailureState | null,
  now: Date,
): LoginFailureState {
  const expired = !previous || now.getTime() - previous.windowStartedAt.getTime() >= LOGIN_WINDOW_MS;
  const failures = expired ? 1 : previous.failures + 1;
  return {
    failures,
    windowStartedAt: expired ? now : previous.windowStartedAt,
    blockedUntil: failures >= MAX_LOGIN_FAILURES ? new Date(now.getTime() + LOGIN_WINDOW_MS) : null,
  };
}

export function retryAfterSeconds(blockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
}

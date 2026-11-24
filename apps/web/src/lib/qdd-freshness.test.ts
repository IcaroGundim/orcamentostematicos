import { describe, expect, it } from 'vitest';
import { assessQddFreshness, businessDaysSince } from './qdd-freshness';

// Rio Branco é UTC-5 o ano todo. 05:00 local = 10:00 UTC, o horário do cron.
const rb = (isoLocal: string) => new Date(`${isoLocal}-05:00`);

describe('businessDaysSince', () => {
  it('conta só os dias úteis depois do dia publicado', () => {
    // 2026-11-20 é sexta; 2026-11-23, segunda.
    expect(businessDaysSince(rb('2026-11-20T05:10'), rb('2026-11-23T09:00'))).toBe(1);
    expect(businessDaysSince(rb('2026-11-20T05:10'), rb('2026-11-24T09:00'))).toBe(2);
    expect(businessDaysSince(rb('2026-11-23T05:10'), rb('2026-11-23T18:00'))).toBe(0);
  });

  it('usa o dia de Rio Branco, não o de UTC', () => {
    // 22:00 de segunda em Rio Branco já é terça em UTC; ainda é o mesmo dia local.
    expect(businessDaysSince(rb('2026-11-23T05:00'), rb('2026-11-23T22:00'))).toBe(0);
  });

  it('não conta o fim de semana', () => {
    expect(businessDaysSince(rb('2026-11-20T05:00'), rb('2026-11-22T12:00'))).toBe(0);
  });
});

describe('assessQddFreshness', () => {
  const now = rb('2026-11-25T09:00'); // quarta

  it('sem base publicada não avisa', () => {
    expect(assessQddFreshness({ revisionDates: [], now }).status).toBe('unknown');
  });

  it('publicação de ontem está em dia', () => {
    const result = assessQddFreshness({ revisionDates: [rb('2026-11-24T05:05')], now });
    expect(result).toMatchObject({ status: 'fresh', businessDays: 1 });
  });

  it('usa a revisão mais recente, de qualquer origem', () => {
    const result = assessQddFreshness({
      revisionDates: [rb('2026-11-10T05:05'), rb('2026-11-24T15:00'), rb('2026-11-12T05:05')],
      now,
    });
    expect(result.status).toBe('fresh');
  });

  it('dois dias úteis sem publicar e sem prévia nova = coleta parada', () => {
    const result = assessQddFreshness({ revisionDates: [rb('2026-11-23T05:05')], now });
    expect(result).toMatchObject({ status: 'stalled', businessDays: 2 });
  });

  it('prévia recente retida = aguardando a SEPLAN, não coleta parada', () => {
    const result = assessQddFreshness({
      revisionDates: [rb('2026-11-20T05:05')],
      pendingGeneratedAt: rb('2026-11-25T05:04'),
      now,
    });
    expect(result.status).toBe('awaiting-review');
  });

  it('prévia também velha = coleta parada', () => {
    const result = assessQddFreshness({
      revisionDates: [rb('2026-11-16T05:05')],
      pendingGeneratedAt: rb('2026-11-18T05:04'),
      now,
    });
    expect(result.status).toBe('stalled');
  });

  it('prévia mais antiga que a publicação é ignorada', () => {
    const result = assessQddFreshness({
      revisionDates: [rb('2026-11-20T05:05')],
      pendingGeneratedAt: rb('2026-11-19T05:04'),
      now,
    });
    expect(result.status).toBe('stalled');
  });
});

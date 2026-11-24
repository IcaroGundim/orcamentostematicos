/**
 * Alerta de coleta parada do QDD.
 *
 * A coleta do SICAF roda todo dia útil às 05:00 de Rio Branco num runner da SEPLAN
 * (`.github/workflows/qdd.yml`). Ela pode parar sem que nenhum workflow FALHE: com a
 * máquina do runner desligada o job só fica na fila; com a publicação automática
 * recusando o delta, a prévia espera a SEPLAN. Nos dois casos o painel continuaria
 * mostrando um QDD velho sem dizer nada — daí medir pela data da última publicação,
 * e não pelo resultado do workflow.
 *
 * Função pura para ser testável; a tela só a chama.
 */

/** A partir de quantos dias úteis sem publicação o painel avisa. */
export const QDD_STALE_BUSINESS_DAYS = 2;

/** Fuso da coleta e da SEPLAN. Datas de calendário são contadas nele, não em UTC. */
export const QDD_TIME_ZONE = 'America/Rio_Branco';

/** AAAA-MM-DD do instante no fuso dado. */
function calendarDate(instant: Date, timeZone: string): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Dias úteis (seg–sex) DEPOIS do dia de `from` até o dia de `now`, inclusive.
 * Publicado na sexta e hoje é segunda → 1. Feriados não são descontados: num feriado a
 * coleta roda do mesmo jeito (o cron não os conhece), então contá-los é coerente.
 */
export function businessDaysSince(from: Date, now: Date, timeZone = QDD_TIME_ZONE): number {
  const start = calendarDate(from, timeZone);
  const end = calendarDate(now, timeZone);
  if (end <= start) return 0;

  // Aritmética em UTC sobre datas de calendário: sem horário de verão no meio.
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let count = 0;
  while (cursor < last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

export type QddFreshness =
  | { status: 'unknown' }
  | { status: 'fresh'; lastPublishedAt: Date; businessDays: number }
  | {
      /** Nenhuma coleta chegou ao app: runner parado, SICAF fora, credencial vencida… */
      status: 'stalled';
      lastPublishedAt: Date;
      businessDays: number;
    }
  | {
      /** A coleta roda, mas a publicação automática recusou e a prévia espera a SEPLAN. */
      status: 'awaiting-review';
      lastPublishedAt: Date;
      businessDays: number;
      pendingGeneratedAt: Date;
    };

export function assessQddFreshness({
  revisionDates,
  pendingGeneratedAt,
  now = new Date(),
  threshold = QDD_STALE_BUSINESS_DAYS,
}: {
  /** `createdAt` das revisões da base do exercício (qualquer origem: SICAF ou manual). */
  revisionDates: Array<string | Date>;
  /** Quando a prévia do SICAF ainda não publicada foi gerada, se houver uma. */
  pendingGeneratedAt?: string | Date | null;
  now?: Date;
  threshold?: number;
}): QddFreshness {
  const times = revisionDates
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));
  // Sem base publicada não há o que envelhecer; a primeira carga é decisão da SEPLAN.
  if (times.length === 0) return { status: 'unknown' };

  const lastPublishedAt = new Date(Math.max(...times));
  const businessDays = businessDaysSince(lastPublishedAt, now);
  if (businessDays < threshold) return { status: 'fresh', lastPublishedAt, businessDays };

  const pending = pendingGeneratedAt ? new Date(pendingGeneratedAt) : null;
  if (pending && Number.isFinite(pending.getTime()) && pending > lastPublishedAt) {
    // A prévia também pode estar velha: se nem ela é recente, a coleta parou de vez.
    if (businessDaysSince(pending, now) < threshold) {
      return { status: 'awaiting-review', lastPublishedAt, businessDays, pendingGeneratedAt: pending };
    }
  }
  return { status: 'stalled', lastPublishedAt, businessDays };
}

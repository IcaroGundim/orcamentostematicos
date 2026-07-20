import 'server-only';

import { prisma } from './prisma';

export type UserActivityAction =
  | 'VALIDATION_SUBMIT'
  | 'VALIDATION_BULK_SUBMIT'
  | 'VALIDATION_APPROVE'
  | 'VALIDATION_RETURN'
  | 'VALIDATION_REVERT'
  | 'VALIDATION_ADMIN_DRAFT'
  | 'ASSIGNMENT_CREATE'
  | 'ASSIGNMENT_UPDATE'
  | 'ASSIGNMENT_DELETE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE';

interface LogInput {
  userId: string;
  action: UserActivityAction;
  entityType?: string;
  entityId?: string;
  organizationCode?: string | null;
  unitCode?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logUserActivity(input: LogInput): Promise<void> {
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        organizationCode: input.organizationCode ?? null,
        unitCode: input.unitCode ?? null,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch {
    // Auditoria nunca deve quebrar o fluxo principal.
  }
}

const LAST_SEEN_THROTTLE_MS = 60_000;

export async function touchLastSeen(userId: string, currentLastSeen: Date | null | undefined): Promise<void> {
  const now = Date.now();
  if (currentLastSeen && now - new Date(currentLastSeen).getTime() < LAST_SEEN_THROTTLE_MS) {
    return;
  }
  try {
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date(now) } });
  } catch {
    /* ignore */
  }
}

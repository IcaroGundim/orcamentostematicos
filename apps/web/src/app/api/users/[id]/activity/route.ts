import { NextRequest } from 'next/server';
import { forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 200);

  const rows = await prisma.userActivityLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return ok({
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      organizationCode: r.organizationCode,
      unitCode: r.unitCode,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

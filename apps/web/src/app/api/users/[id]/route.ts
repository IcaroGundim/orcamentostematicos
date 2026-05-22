import { NextRequest } from 'next/server';
import { badRequest, forbidden, getAuthUser, notFound, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { logUserActivity } from '@/lib/user-activity';
import type { UserRole } from '@/types/domain';

const VALID_ROLES: UserRole[] = ['SEPLAN_ADMIN', 'SECRETARIA_REPRESENTANTE', 'SECRETARIA_REVISOR'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    return badRequest('role inválido.');
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.email !== undefined) data.email = String(body.email).toLowerCase().trim();
  if (body.password) data.password = String(body.password);
  if (body.role !== undefined) data.role = body.role;
  if (body.organizationCode !== undefined) data.organizationCode = body.organizationCode || null;
  if (body.unitCode !== undefined) data.unitCode = body.unitCode || null;
  if (body.active !== undefined) data.active = !!body.active;

  const updated = await prisma.user.update({ where: { id }, data }).catch(() => null);
  if (!updated) return notFound('Usuário não encontrado.');

  // Se desativado, remove sessões existentes (logout forçado).
  if (body.active === false) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  await logUserActivity({
    userId: user.id,
    action: 'USER_UPDATE',
    entityType: 'User',
    entityId: id,
    organizationCode: updated.organizationCode,
    unitCode: updated.unitCode,
    metadata: { fields: Object.keys(data) },
  });

  const { password: _pw, ...safe } = updated;
  return ok(safe);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const { id } = await params;
  if (id === user.id) return badRequest('Você não pode excluir o próprio usuário.');

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, organizationCode: true, unitCode: true },
  });
  if (!target) return notFound('Usuário não encontrado.');

  // ThematicAssignment.createdBy é FK sem cascade — bloqueia exclusão se houver
  // classificações criadas pelo usuário.
  const assignmentCount = await prisma.thematicAssignment.count({ where: { createdBy: id } });
  if (assignmentCount > 0) {
    return badRequest(
      'Usuário possui classificações temáticas criadas — desative em vez de excluir.',
    );
  }

  await prisma.user.delete({ where: { id } });

  await logUserActivity({
    userId: user.id,
    action: 'USER_DELETE',
    entityType: 'User',
    entityId: id,
    metadata: { name: target.name, email: target.email, role: target.role },
  });

  return ok({ success: true });
}

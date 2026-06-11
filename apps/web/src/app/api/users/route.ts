import { NextRequest } from 'next/server';
import { badRequest, conflict, forbidden, getAuthUser, ok, unauthorized } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { logUserActivity } from '@/lib/user-activity';
import type { UserRole } from '@/types/domain';

const VALID_ROLES: UserRole[] = ['SEPLAN_ADMIN', 'SECRETARIA_REPRESENTANTE'];

const ACTIVE_SESSION_WINDOW_MS = 30 * 60 * 1000;

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      organizationCode: true,
      unitCode: true,
      active: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: [{ organizationCode: 'asc' }, { unitCode: 'asc' }, { name: 'asc' }],
  });

  const userIds = users.map((u) => u.id);

  // Sessões ativas — última sessão por usuário, considerada ativa se criada na janela.
  const recentSessions = await prisma.session.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  const latestSession = new Map<string, Date>();
  for (const s of recentSessions) {
    if (!latestSession.has(s.userId)) latestSession.set(s.userId, s.createdAt);
  }

  // Contagens de pendências por usuário.
  // pendingCuration: ThematicAssignment com status RASCUNHO criados pelo usuário.
  const curationGroups = await prisma.thematicAssignment.groupBy({
    by: ['createdBy'],
    where: { createdBy: { in: userIds }, status: 'RASCUNHO' },
    _count: { _all: true },
  });
  const pendingCuration = new Map<string, number>(
    curationGroups.map((g) => [g.createdBy, g._count._all]),
  );

  // pendingValidation / pendingDrafts: por (organizationCode, role).
  // - REPRESENTANTE: itens RASCUNHO/DEVOLVIDO no escopo.
  const orgsInPlay = Array.from(
    new Set(users.map((u) => u.organizationCode).filter((c): c is string => Boolean(c))),
  );
  const orgCounts = orgsInPlay.length
    ? await prisma.actionValidation.groupBy({
        by: ['organizationCode', 'status'],
        where: { organizationCode: { in: orgsInPlay } },
        _count: { _all: true },
      })
    : [];
  const countByOrgStatus = new Map<string, number>();
  for (const g of orgCounts) {
    countByOrgStatus.set(`${g.organizationCode}::${g.status}`, g._count._all);
  }
  const sumStatuses = (org: string, statuses: string[]) =>
    statuses.reduce((acc, s) => acc + (countByOrgStatus.get(`${org}::${s}`) ?? 0), 0);

  const now = Date.now();
  const items = users.map((u) => {
    const lastSession = latestSession.get(u.id) ?? null;
    const sessionActive = !!lastSession && now - lastSession.getTime() < ACTIVE_SESSION_WINDOW_MS;
    const org = u.organizationCode;
    const pendingReview = 0;
    let pendingValidation = 0;
    let pendingDrafts = 0;
    if (org) {
      if (u.role === 'SECRETARIA_REPRESENTANTE') {
        pendingDrafts = sumStatuses(org, ['RASCUNHO', 'DEVOLVIDO']);
        pendingValidation = sumStatuses(org, ['ENVIADO']);
      }
      if (u.role === 'SEPLAN_ADMIN') {
        pendingValidation = sumStatuses(org, ['ENVIADO']);
      }
    }

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      organizationCode: u.organizationCode,
      unitCode: u.unitCode,
      active: u.active,
      lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      sessionActive,
      pendingCuration: pendingCuration.get(u.id) ?? 0,
      pendingDrafts,
      pendingReview,
      pendingValidation,
    };
  });

  return ok({ users: items });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (user.role !== 'SEPLAN_ADMIN') return forbidden();

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.email || !body?.password || !body?.role) {
    return badRequest('name, email, password e role são obrigatórios.');
  }
  if (!VALID_ROLES.includes(body.role)) return badRequest('role inválido.');

  const email = String(body.email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return conflict('Já existe um usuário com este e-mail.');

  const username = body.username ? String(body.username).toLowerCase().trim() : null;
  if (username) {
    const usernameTaken = await prisma.user.findUnique({ where: { username } });
    if (usernameTaken) return conflict('Já existe um usuário com este nome de usuário.');
  }

  const created = await prisma.user.create({
    data: {
      name: String(body.name).trim(),
      email,
      username,
      password: String(body.password),
      role: body.role,
      organizationCode: body.organizationCode || null,
      unitCode: body.unitCode || null,
      active: body.active === false ? false : true,
    },
  });

  await logUserActivity({
    userId: user.id,
    action: 'USER_CREATE',
    entityType: 'User',
    entityId: created.id,
    organizationCode: created.organizationCode,
    unitCode: created.unitCode,
    metadata: { name: created.name, email: created.email, username: created.username, role: created.role },
  });

  const { password: _pw, ...safe } = created;
  return ok(safe);
}

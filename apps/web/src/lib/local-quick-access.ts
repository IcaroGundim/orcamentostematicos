import type { User, UserRole } from '@/types/domain';

const HAS_LOGGED_IN_KEY = 'otac-has-logged-in';
const QUICK_ACCESS_KEY = 'otac-quick-access-v1';
const MAX_ENTRIES = 8;
/** Conta removida do acesso rápido após este período sem login com ela. */
export const QUICK_ACCESS_MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

export type QuickAccessEntry = {
  identifier: string;
  password: string;
  name: string;
  role: UserRole;
  organizationCode?: string;
  lastUsedAt: string;
};

const ROLE_LABELS: Record<UserRole, string> = {
  SEPLAN_ADMIN: 'SEPLAN (Admin)',
  SECRETARIA_REPRESENTANTE: 'Técnico',
};

const ROLE_BADGES: Record<UserRole, string> = {
  SEPLAN_ADMIN: 'SEPLAN',
  SECRETARIA_REPRESENTANTE: 'Técnico',
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function isValidEntry(entry: unknown): entry is QuickAccessEntry {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const candidate = entry as QuickAccessEntry;
  return (
    typeof candidate.identifier === 'string' &&
    typeof candidate.password === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.role === 'string' &&
    typeof candidate.lastUsedAt === 'string'
  );
}

function parseEntries(raw: string | null): QuickAccessEntry[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

function sortEntries(entries: QuickAccessEntry[]): QuickAccessEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
  );
}

function isEntryActive(entry: QuickAccessEntry, now = Date.now()): boolean {
  const lastUsed = new Date(entry.lastUsedAt).getTime();
  if (Number.isNaN(lastUsed)) {
    return false;
  }
  return now - lastUsed < QUICK_ACCESS_MAX_IDLE_MS;
}

function filterActiveEntries(entries: QuickAccessEntry[]): QuickAccessEntry[] {
  return entries.filter((entry) => isEntryActive(entry));
}

/** Remove entradas inativas há 7+ dias e persiste; limpa tudo se não sobrar nenhuma. */
function pruneAndPersist(storage: Storage): QuickAccessEntry[] {
  const parsed = parseEntries(storage.getItem(QUICK_ACCESS_KEY));
  const active = sortEntries(filterActiveEntries(parsed));

  if (active.length === 0) {
    storage.removeItem(HAS_LOGGED_IN_KEY);
    storage.removeItem(QUICK_ACCESS_KEY);
    return [];
  }

  if (active.length !== parsed.length) {
    storage.setItem(QUICK_ACCESS_KEY, JSON.stringify(active));
  }

  return active;
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function roleBadge(role: UserRole): string {
  return ROLE_BADGES[role];
}

export function hasLocalLoginHistory(): boolean {
  return getQuickAccessEntries().length > 0;
}

export function hasQuickAccessEntry(identifier: string): boolean {
  const identifierKey = normalizeIdentifier(identifier);
  return getQuickAccessEntries().some(
    (entry) => normalizeIdentifier(entry.identifier) === identifierKey,
  );
}

export function getQuickAccessEntries(): QuickAccessEntry[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  return pruneAndPersist(storage);
}

export function recordSuccessfulLogin(params: {
  identifier: string;
  password: string;
  user: Pick<User, 'name' | 'role' | 'organizationCode'>;
}): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(HAS_LOGGED_IN_KEY, '1');

  const identifier = params.identifier.trim();
  const identifierKey = normalizeIdentifier(identifier);
  const entries = pruneAndPersist(storage);
  const updated: QuickAccessEntry = {
    identifier,
    password: params.password,
    name: params.user.name,
    role: params.user.role,
    lastUsedAt: new Date().toISOString(),
    ...(params.user.organizationCode ? { organizationCode: params.user.organizationCode } : {}),
  };

  const next = sortEntries([
    updated,
    ...entries.filter((entry) => normalizeIdentifier(entry.identifier) !== identifierKey),
  ]).slice(0, MAX_ENTRIES);

  storage.setItem(QUICK_ACCESS_KEY, JSON.stringify(next));
}

export function clearQuickAccessOnDevice(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(HAS_LOGGED_IN_KEY);
  storage.removeItem(QUICK_ACCESS_KEY);
}

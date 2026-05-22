'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2Icon,
  ChevronDownIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  GovernmentOrganizationCatalog,
  UserActivityEntry,
  UserRole,
  UserSummary,
} from '@/types/domain';

const roleLabels: Record<UserRole, string> = {
  SEPLAN_ADMIN: 'SEPLAN (Admin)',
  SECRETARIA_REPRESENTANTE: 'Representante',
  SECRETARIA_REVISOR: 'Revisor',
};

const actionLabels: Record<string, string> = {
  VALIDATION_SUBMIT: 'Enviou validação ao revisor',
  VALIDATION_BULK_SUBMIT: 'Envio em lote de validações',
  VALIDATION_REVIEWER_APPROVE: 'Aprovou validação (revisor)',
  VALIDATION_REVIEWER_RETURN: 'Devolveu validação (revisor)',
  VALIDATION_BULK_REVIEW: 'Revisão em lote',
  VALIDATION_APPROVE: 'Aprovou validação (SEPLAN)',
  VALIDATION_RETURN: 'Devolveu validação (SEPLAN)',
  VALIDATION_REVERT: 'Reabriu validação aprovada',
  ASSIGNMENT_CREATE: 'Criou classificação temática',
  ASSIGNMENT_UPDATE: 'Editou classificação temática',
  ASSIGNMENT_DELETE: 'Removeu classificação temática',
  USER_CREATE: 'Criou usuário',
  USER_UPDATE: 'Editou usuário',
  USER_DELETE: 'Excluiu usuário',
};

interface Props {
  organizations: GovernmentOrganizationCatalog[];
}

type FormState = {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationCode: string;
  unitCode: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'SECRETARIA_REPRESENTANTE',
  organizationCode: '',
  unitCode: '',
  active: true,
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'Nunca acessou';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora há pouco';
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formFromUser(user: UserSummary): FormState {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    organizationCode: user.organizationCode ?? '',
    unitCode: user.unitCode ?? '',
    active: user.active,
  };
}

async function saveUserForm(form: FormState): Promise<void> {
  if (!form.name.trim() || !form.email.trim()) {
    toast.error('Nome e e-mail são obrigatórios.');
    throw new Error('validation');
  }
  if (!form.id && !form.password) {
    toast.error('Defina uma senha inicial.');
    throw new Error('validation');
  }

  const payload: Record<string, unknown> = {
    name: form.name,
    email: form.email,
    role: form.role,
    organizationCode: form.organizationCode || null,
    unitCode: form.unitCode || null,
    active: form.active,
  };
  if (form.password) payload.password = form.password;

  if (form.id) {
    await api(`/users/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    toast.success('Usuário atualizado.');
  } else {
    await api('/users', { method: 'POST', body: JSON.stringify(payload) });
    toast.success('Usuário criado.');
  }
}

export function UsersPanel({ organizations }: Props) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [createSaving, setCreateSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<UserSummary | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await api<{ users: UserSummary[] }>('/users');
      setUsers(data.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const orgIndex = useMemo(() => {
    const m = new Map<string, GovernmentOrganizationCatalog>();
    for (const o of organizations) m.set(o.code, o);
    return m;
  }, [organizations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !u.active) return false;
      if (statusFilter === 'INACTIVE' && u.active) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organizationCode ?? '').toLowerCase().includes(q) ||
        (u.unitCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, UserSummary[]>();
    const SEM_ORG = '__sem_org__';
    for (const u of filtered) {
      const key = u.organizationCode ?? SEM_ORG;
      const arr = map.get(key) ?? [];
      arr.push(u);
      map.set(key, arr);
    }
    const ordered = Array.from(map.entries()).map(([code, list]) => {
      const org = code === SEM_ORG ? null : orgIndex.get(code) ?? null;
      return {
        code,
        name: org?.name ?? (code === SEM_ORG ? 'Sem vínculo' : code),
        users: list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      };
    });
    ordered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return ordered;
  }, [filtered, orgIndex]);

  function toggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function submitCreate() {
    setCreateSaving(true);
    try {
      await saveUserForm(createForm);
      setCreateOpen(false);
      setCreateForm(emptyForm);
      await reload();
    } catch (err) {
      if (!(err instanceof Error && err.message === 'validation')) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
      }
    } finally {
      setCreateSaving(false);
    }
  }

  async function confirmDeletion() {
    if (!confirmDelete) return;
    try {
      await api(`/users/${confirmDelete.id}`, { method: 'DELETE' });
      toast.success('Usuário excluído.');
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Usuários por secretaria</CardTitle>
            <CardDescription>
              Controle quem atua em cada secretaria/unidade, papel atribuído, presença e
              histórico de ações.
            </CardDescription>
          </div>
          <Popover
            modal={false}
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) setCreateForm(emptyForm);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                size="sm"
                onClick={() => {
                  setCreateForm(emptyForm);
                  setCreateOpen(true);
                }}
              >
                <PlusIcon className="size-4" />
                Novo usuário
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="bottom" className="w-[min(96vw,24rem)] p-0">
              <UserFormContent
                title="Novo usuário"
                description="Defina papel e vínculo com a secretaria/unidade. Usuários inativos não conseguem fazer login."
                form={createForm}
                setForm={setCreateForm}
                organizations={organizations}
                saving={createSaving}
                onSubmit={() => void submitCreate()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail, órgão ou unidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'ALL' | UserRole)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os papéis</SelectItem>
              <SelectItem value="SEPLAN_ADMIN">{roleLabels.SEPLAN_ADMIN}</SelectItem>
              <SelectItem value="SECRETARIA_REPRESENTANTE">{roleLabels.SECRETARIA_REPRESENTANTE}</SelectItem>
              <SelectItem value="SECRETARIA_REVISOR">{roleLabels.SECRETARIA_REVISOR}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos status</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="INACTIVE">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando usuários...</p>
        ) : grouped.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersIcon className="size-6" />
              </EmptyMedia>
              <EmptyTitle>Nenhum usuário encontrado</EmptyTitle>
              <EmptyDescription>Ajuste os filtros ou cadastre um novo usuário.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {grouped.map((g) => {
              const isOpen = expanded.has(g.code);
              return (
                <div key={g.code} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => toggle(g.code)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <Building2Icon className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{g.name}</span>
                      <Badge variant="secondary">{g.users.length}</Badge>
                    </div>
                    <ChevronDownIcon
                      className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                    />
                  </button>
                  {isOpen ? (
                    <div className="divide-y border-t">
                      {g.users.map((u) => (
                        <UserRow
                          key={u.id}
                          user={u}
                          organizations={organizations}
                          onDelete={() => setConfirmDelete(u)}
                          onSaved={() => void reload()}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `Esta ação remove ${confirmDelete.name} (${confirmDelete.email}) e suas sessões. Não pode ser desfeita.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletion}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface UserFormContentProps {
  title: string;
  description: string;
  form: FormState;
  setForm: (form: FormState) => void;
  organizations: GovernmentOrganizationCatalog[];
  saving: boolean;
  onSubmit: () => void;
}

function UserFormContent({
  title,
  description,
  form,
  setForm,
  organizations,
  saving,
  onSubmit,
}: UserFormContentProps) {
  const orgUnits = organizations.find((o) => o.code === form.organizationCode)?.units ?? [];

  return (
    <div className="flex max-h-[min(85vh,40rem)] flex-col gap-3 overflow-y-auto p-4">
      <div className="space-y-1">
        <p className="font-semibold leading-none">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Field label="Nome">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="E-mail">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </Field>
      <Field label={form.id ? 'Nova senha (opcional)' : 'Senha inicial'}>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={form.id ? 'Deixe em branco para manter' : ''}
        />
      </Field>
      <Field label="Papel">
        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SEPLAN_ADMIN">{roleLabels.SEPLAN_ADMIN}</SelectItem>
            <SelectItem value="SECRETARIA_REPRESENTANTE">{roleLabels.SECRETARIA_REPRESENTANTE}</SelectItem>
            <SelectItem value="SECRETARIA_REVISOR">{roleLabels.SECRETARIA_REVISOR}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Secretaria/órgão">
        <Select
          value={form.organizationCode || '__none__'}
          onValueChange={(v) =>
            setForm({
              ...form,
              organizationCode: v === '__none__' ? '' : v,
              unitCode: '',
            })
          }
        >
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem vínculo</SelectItem>
            {organizations.map((o) => (
              <SelectItem key={o.code} value={o.code}>
                {o.code} — {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Unidade orçamentária">
        <Select
          value={form.unitCode || '__none__'}
          onValueChange={(v) => setForm({ ...form, unitCode: v === '__none__' ? '' : v })}
          disabled={!form.organizationCode}
        >
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem unidade</SelectItem>
            {orgUnits.map((u) => (
              <SelectItem key={u.code} value={u.code}>
                {u.code} — {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Ativo
      </label>
      <Button onClick={onSubmit} disabled={saving} className="w-full">
        {saving ? 'Salvando...' : 'Salvar'}
      </Button>
    </div>
  );
}

interface UserRowProps {
  user: UserSummary;
  organizations: GovernmentOrganizationCatalog[];
  onDelete: () => void;
  onSaved: () => void;
}

function UserRow({ user, organizations, onDelete, onSaved }: UserRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<FormState>(() => formFromUser(user));
  const [editSaving, setEditSaving] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<UserActivityEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!historyOpen) return;
    setHistoryLoading(true);
    void api<{ entries: UserActivityEntry[] }>(`/users/${user.id}/activity?limit=30`)
      .then((data) => setHistoryEntries(data.entries))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar histórico.');
      })
      .finally(() => setHistoryLoading(false));
  }, [historyOpen, user.id]);

  async function submitEdit() {
    setEditSaving(true);
    try {
      await saveUserForm(editForm);
      setEditOpen(false);
      onSaved();
    } catch (err) {
      if (!(err instanceof Error && err.message === 'validation')) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{user.name}</span>
          <Badge variant="outline">{roleLabels[user.role]}</Badge>
          {!user.active ? <Badge variant="destructive">Inativo</Badge> : null}
          {user.sessionActive ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90">
              Sessão ativa
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        <p className="text-xs text-muted-foreground">
          {user.unitCode ? `Unidade ${user.unitCode}` : 'Sem unidade'} · Último acesso{' '}
          {formatRelative(user.lastSeenAt)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {user.pendingCuration > 0 ? (
            <Badge variant="secondary">Em curadoria: {user.pendingCuration}</Badge>
          ) : null}
          {user.pendingDrafts > 0 ? (
            <Badge variant="secondary">Rascunhos/devolvidos: {user.pendingDrafts}</Badge>
          ) : null}
          {user.pendingReview > 0 ? (
            <Badge variant="secondary">Aguardando revisão: {user.pendingReview}</Badge>
          ) : null}
          {user.pendingValidation > 0 ? (
            <Badge variant="secondary">Em validação SEPLAN: {user.pendingValidation}</Badge>
          ) : null}
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-1">
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" title="Histórico">
              <HistoryIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-[min(96vw,28rem)] p-0">
            <div className="flex max-h-[min(70vh,24rem)] flex-col gap-2 overflow-y-auto p-4">
              <div className="space-y-1">
                <p className="font-semibold leading-none">Histórico — {user.name}</p>
                <p className="text-sm text-muted-foreground">
                  Últimas ações registradas para este usuário.
                </p>
              </div>
              {historyLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : historyEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem atividade registrada.</p>
              ) : (
                historyEntries.map((e) => (
                  <div key={e.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{actionLabels[e.action] ?? e.action}</span>
                      <span className="text-xs text-muted-foreground">{formatRelative(e.createdAt)}</span>
                    </div>
                    {e.entityId ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {e.entityType} · {e.entityId}
                      </p>
                    ) : null}
                    {e.organizationCode ? (
                      <p className="text-xs text-muted-foreground">
                        Órgão: {e.organizationCode}
                        {e.unitCode ? ` · Unidade: ${e.unitCode}` : ''}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover
          modal={false}
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (open) setEditForm(formFromUser(user));
          }}
        >
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              title="Editar"
              onClick={() => {
                setEditForm(formFromUser(user));
                setEditOpen(true);
              }}
            >
              <PencilIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" className="w-[min(96vw,24rem)] p-0">
            <UserFormContent
              title="Editar usuário"
              description="Defina papel e vínculo com a secretaria/unidade. Usuários inativos não conseguem fazer login."
              form={editForm}
              setForm={setEditForm}
              organizations={organizations}
              saving={editSaving}
              onSubmit={() => void submitEdit()}
            />
          </PopoverContent>
        </Popover>

        <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir">
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

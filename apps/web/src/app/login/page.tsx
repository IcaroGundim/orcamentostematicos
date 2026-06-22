'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  LogInIcon,
  MailIcon,
  SaveIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { LoginQuickAccess } from '@/components/domain/login-quick-access';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, setStoredSession, type Session } from '@/lib/api';
import { hasQuickAccessEntry, recordSuccessfulLogin } from '@/lib/local-quick-access';
import type { User } from '@/types/domain';

type View = 'login' | 'forgot' | 'reset';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Informe seu e-mail ou nome de usuário.'),
  password: z.string().min(3),
});
type LoginFormData = z.infer<typeof loginSchema>;

const forgotSchema = z.object({
  identifier: z.string().min(1, 'Informe seu e-mail ou nome de usuário.'),
});
type ForgotFormData = z.infer<typeof forgotSchema>;

const resetSchema = z
  .object({
    password: z.string().min(3, 'A senha deve ter pelo menos 3 caracteres.'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.confirmarSenha, {
    message: 'As senhas não coincidem.',
    path: ['confirmarSenha'],
  });
type ResetFormData = z.infer<typeof resetSchema>;

type PendingQuickAccessSave = {
  identifier: string;
  password: string;
  user: Pick<User, 'name' | 'role' | 'organizationCode'>;
  redirectTo: string;
};

// ---------------------------------------------------------------------------
// View: login
// ---------------------------------------------------------------------------
function LoginView({ onForgot }: { onForgot: () => void }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pendingQuickAccessSave, setPendingQuickAccessSave] = useState<PendingQuickAccessSave | null>(null);
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });
  const isSubmitting = form.formState.isSubmitting;

  function confirmQuickAccessSave() {
    if (!pendingQuickAccessSave) return;
    recordSuccessfulLogin({
      identifier: pendingQuickAccessSave.identifier,
      password: pendingQuickAccessSave.password,
      user: pendingQuickAccessSave.user,
    });
    const redirectTo = pendingQuickAccessSave.redirectTo;
    setPendingQuickAccessSave(null);
    router.push(redirectTo);
  }

  function declineQuickAccessSave() {
    if (!pendingQuickAccessSave) return;
    const redirectTo = pendingQuickAccessSave.redirectTo;
    setPendingQuickAccessSave(null);
    router.push(redirectTo);
  }

  async function performLogin(
    identifier: string,
    password: string,
    options?: { fromQuickAccess?: boolean },
  ) {
    setError('');
    try {
      const session = await api<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setStoredSession(session);
      const redirectTo = session.user.role === 'SEPLAN_ADMIN' ? '/seplan' : '/secretaria';

      if (options?.fromQuickAccess || hasQuickAccessEntry(identifier)) {
        recordSuccessfulLogin({ identifier, password, user: session.user });
        router.push(redirectTo);
        return;
      }

      setPendingQuickAccessSave({ identifier, password, user: session.user, redirectTo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login.');
    }
  }

  async function onSubmit(values: LoginFormData) {
    await performLogin(values.identifier, values.password);
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Entrar</h2>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="identifier">E-mail ou nome de usuário</FieldLabel>
            <Input id="identifier" type="text" autoComplete="username" disabled={isSubmitting} {...form.register('identifier')} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              {...form.register('password')}
            />
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Login não realizado</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <LogInIcon data-icon="inline-start" />
            )}
            {isSubmitting ? 'Entrando...' : 'Acessar'}
          </Button>
          <button
            type="button"
            onClick={onForgot}
            className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </button>
        </FieldGroup>
      </form>

      <LoginQuickAccess
        disabled={isSubmitting}
        onQuickLogin={(identifier, password) =>
          performLogin(identifier, password, { fromQuickAccess: true })
        }
      />

      <AlertDialog
        open={pendingQuickAccessSave !== null}
        onOpenChange={(open) => {
          if (!open && pendingQuickAccessSave) declineQuickAccessSave();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar atalho neste dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha ficará guardada apenas neste navegador para entrar com um clique. Qualquer pessoa com
              acesso ao computador poderá usar o atalho. Você pode remover depois em &quot;Esquecer atalhos
              neste dispositivo&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" onClick={declineQuickAccessSave}>
              Não salvar
            </AlertDialogCancel>
            <Button type="button" onClick={confirmQuickAccessSave}>
              Sim, salvar atalho
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// View: forgot
// ---------------------------------------------------------------------------
function ForgotView({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { identifier: '' },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: ForgotFormData) {
    setError('');
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: values.identifier }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.');
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Esqueci minha senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail ou nome de usuário e enviaremos um link para redefinir a senha.
        </p>
      </div>

      {sent ? (
        <div className="flex flex-col gap-4">
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Verifique seu e-mail</AlertTitle>
            <AlertDescription>
              Se houver uma conta com esses dados, enviamos um e-mail com instruções para redefinir
              a senha. O link é válido por 1 hora.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full" onClick={onBack}>
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar para o login
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="forgot-identifier">E-mail ou nome de usuário</FieldLabel>
              <Input
                id="forgot-identifier"
                type="text"
                autoComplete="username"
                disabled={isSubmitting}
                {...form.register('identifier')}
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Não foi possível enviar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <MailIcon data-icon="inline-start" />
              )}
              {isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'}
            </Button>
            <button
              type="button"
              onClick={onBack}
              className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Voltar para o login
            </button>
          </FieldGroup>
        </form>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// View: reset
// ---------------------------------------------------------------------------
function ResetView({
  token,
  onDone,
  onRequestNew,
}: {
  token: string;
  onDone: () => void;
  onRequestNew: () => void;
}) {
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmarSenha: '' },
  });
  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    let active = true;
    if (!token) {
      setTokenValid(false);
      return;
    }
    api<{ valid: boolean }>(`/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (active) setTokenValid(res.valid);
      })
      .catch(() => {
        if (active) setTokenValid(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function onSubmit(values: ResetFormData) {
    setError('');
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password: values.password }),
      });
      toast.success('Senha redefinida com sucesso. Faça login com a nova senha.');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    }
  }

  if (tokenValid === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-4 animate-spin" />
        Validando link...
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Link inválido ou expirado</AlertTitle>
          <AlertDescription>
            Este link de redefinição não é mais válido. Solicite um novo para continuar.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={onRequestNew}>
          Solicitar novo link
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Voltar para o login
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight">Definir nova senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma nova senha para acessar sua conta.
        </p>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reset-password">Nova senha</FieldLabel>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...form.register('password')}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="reset-confirm">Confirmar nova senha</FieldLabel>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              {...form.register('confirmarSenha')}
            />
            <FieldError errors={[form.formState.errors.confirmarSenha]} />
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Não foi possível redefinir</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : (
              <SaveIcon data-icon="inline-start" />
            )}
            {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
          <button
            type="button"
            onClick={onDone}
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeftIcon className="size-3.5" />
            Voltar para o login
          </button>
        </FieldGroup>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Card que controla qual view exibir (usa useSearchParams → dentro de Suspense)
// ---------------------------------------------------------------------------
function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [view, setView] = useState<View>(token ? 'reset' : 'login');

  function goToLogin() {
    setView('login');
    if (token) router.replace('/login');
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
      {view === 'reset' ? (
        <ResetView token={token} onDone={goToLogin} onRequestNew={() => setView('forgot')} />
      ) : view === 'forgot' ? (
        <ForgotView onBack={goToLogin} />
      ) : (
        <LoginView onForgot={() => setView('forgot')} />
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="grid min-h-screen w-full lg:grid-cols-[1fr_480px]">

        <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
          <div>
            <Image
              src="/logo.svg"
              alt="SEPLAN — Secretaria de Estado de Planejamento"
              width={260}
              height={72}
              className="h-14 w-auto"
              priority
            />
          </div>

          <div className="flex flex-col gap-5">
            <div className="h-px w-16 bg-primary-foreground/30" />
            <h1 className="max-w-md text-5xl font-semibold leading-[1.15] tracking-tight">
              Orçamentos<br />Temáticos
            </h1>
            <p className="max-w-lg text-base leading-7 text-primary-foreground/70">
              Os orçamentos temáticos são instrumentos estratégicos que organizam e apresentam a aplicação dos recursos públicos de forma segmentada, permitindo uma análise detalhada das políticas públicas voltadas a áreas prioritárias.
            </p>
          </div>

          <p className="text-xs text-primary-foreground/35">
            © {new Date().getFullYear()} Governo do Estado do Acre
          </p>
        </div>

        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/20 px-6 py-10 sm:gap-8 sm:px-8 sm:py-12">
          <Image
            src="/logo-governo-acre-horizontal.png"
            alt="Governo do Estado do Acre"
            width={480}
            height={140}
            className="h-28 w-auto object-contain sm:h-36"
            priority
          />

          {/* título mobile — oculto em telas lg+ onde o painel esquerdo já exibe o nome */}
          <div className="flex flex-col items-center gap-1 text-center lg:hidden">
            <h1 className="text-2xl font-semibold tracking-tight">Orçamentos Temáticos</h1>
            <p className="text-sm text-muted-foreground">SEPLAN — Secretaria de Estado de Planejamento</p>
          </div>

          <Suspense
            fallback={
              <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Carregando...
                </div>
              </div>
            }
          >
            <LoginCard />
          </Suspense>
        </div>

      </section>
    </main>
  );
}

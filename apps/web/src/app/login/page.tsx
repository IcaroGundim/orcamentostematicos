'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircleIcon, LoaderCircleIcon, LogInIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { api, setStoredSession, type Session } from '@/lib/api';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(3),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'admin@seplan.ac.gov.br', password: 'admin123' },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormData) {
    setError('');
    try {
      const session = await api<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setStoredSession(session);
      router.push(session.user.role === 'SEPLAN_ADMIN' ? '/seplan' : '/secretaria');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login.');
    }
  }

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

        <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/20 px-8 py-12">
          <Image
            src="/logo-governo-acre-horizontal.png"
            alt="Governo do Estado do Acre"
            width={480}
            height={140}
            className="h-36 w-auto object-contain"
            priority
          />

          {/* título mobile — oculto em telas lg+ onde o painel esquerdo já exibe o nome */}
          <div className="flex flex-col items-center gap-1 text-center lg:hidden">
            <h1 className="text-2xl font-semibold tracking-tight">Orçamentos Temáticos</h1>
            <p className="text-sm text-muted-foreground">SEPLAN — Secretaria de Estado de Planejamento</p>
          </div>

          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Entrar</h2>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input id="email" type="email" autoComplete="email" disabled={isSubmitting} {...form.register('email')} />
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
              </FieldGroup>
            </form>

            <Separator className="my-5" />

            <div className="mt-2 flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">
                Acesso Rápido de Homologação (Debug)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    form.setValue('email', 'admin@seplan.ac.gov.br');
                    form.setValue('password', 'admin123');
                    void form.handleSubmit(onSubmit)();
                  }}
                  className="col-span-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-left transition-all hover:bg-primary/10 hover:border-primary/40 disabled:opacity-50"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-primary">Gestor SEPLAN (Administrador)</span>
                    <span className="text-[9px] text-muted-foreground">admin@seplan.ac.gov.br</span>
                  </div>
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[8px] font-semibold text-white uppercase">SEPLAN</span>
                </button>
                
                <div className="col-span-2 grid grid-cols-2 gap-1.5 border-t border-border pt-2">
                  <span className="col-span-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">SEMULHER (Mulher)</span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      form.setValue('email', 'semulher@ac.gov.br');
                      form.setValue('password', 'secretaria123');
                      void form.handleSubmit(onSubmit)();
                    }}
                    className="flex flex-col rounded-lg border border-border bg-card p-2 text-left transition-all hover:bg-muted disabled:opacity-50"
                  >
                    <span className="text-[10px] font-bold text-foreground">Técnico</span>
                    <span className="text-[8px] text-muted-foreground truncate w-full">semulher@ac.gov.br</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      form.setValue('email', 'revisor.semulher@ac.gov.br');
                      form.setValue('password', 'secretaria123');
                      void form.handleSubmit(onSubmit)();
                    }}
                    className="flex flex-col rounded-lg border border-border bg-card p-2 text-left transition-all hover:bg-muted disabled:opacity-50"
                  >
                    <span className="text-[10px] font-bold text-foreground">Revisor</span>
                    <span className="text-[8px] text-muted-foreground truncate w-full">revisor.semulher@ac.gov.br</span>
                  </button>
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-1.5 border-t border-border pt-2">
                  <span className="col-span-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">SESACRE (Saúde)</span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      form.setValue('email', 'sesacre@ac.gov.br');
                      form.setValue('password', 'secretaria123');
                      void form.handleSubmit(onSubmit)();
                    }}
                    className="flex flex-col rounded-lg border border-border bg-card p-2 text-left transition-all hover:bg-muted disabled:opacity-50"
                  >
                    <span className="text-[10px] font-bold text-foreground">Técnico</span>
                    <span className="text-[8px] text-muted-foreground truncate w-full">sesacre@ac.gov.br</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      form.setValue('email', 'revisor.sesacre@ac.gov.br');
                      form.setValue('password', 'secretaria123');
                      void form.handleSubmit(onSubmit)();
                    }}
                    className="flex flex-col rounded-lg border border-border bg-card p-2 text-left transition-all hover:bg-muted disabled:opacity-50"
                  >
                    <span className="text-[10px] font-bold text-foreground">Revisor</span>
                    <span className="text-[8px] text-muted-foreground truncate w-full">revisor.sesacre@ac.gov.br</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}

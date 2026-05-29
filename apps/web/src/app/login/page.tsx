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
    defaultValues: { email: '', password: '' },
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
          </div>
        </div>

      </section>
    </main>
  );
}

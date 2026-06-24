'use client';

import { useCallback, useState } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudSunIcon,
  GraduationCapIcon,
  InfoIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  VenusIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ *
 * Mini-mockups (apenas visuais — imitam a interface real do sistema)  *
 * ------------------------------------------------------------------ */

function FigureFrame({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <figure className="rounded-xl border bg-muted/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5" aria-hidden>
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 text-[0.7rem] font-medium text-muted-foreground">Pré-visualização</span>
      </div>
      {children}
      {caption ? <figcaption className="mt-3 text-xs text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

function MockField({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div
        className={cn(
          'flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-sm',
          accent ? 'border-primary/50 font-medium text-foreground' : 'text-foreground/80',
        )}
      >
        <span>{value}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function MockBadge({ tone, children }: { tone: 'rascunho' | 'enviado' | 'aprovado'; children: React.ReactNode }) {
  const cls =
    tone === 'aprovado'
      ? 'bg-primary text-primary-foreground'
      : tone === 'enviado'
        ? 'border border-border bg-background text-foreground'
        : 'bg-muted text-foreground';
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', cls)}>{children}</span>;
}

function MockButton({ children, subtle }: { children: React.ReactNode; subtle?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
        subtle ? 'border bg-background text-foreground' : 'bg-primary text-primary-foreground',
      )}
    >
      {children}
    </span>
  );
}

const THEME_CARDS = [
  {
    name: 'OCAD',
    full: 'Orçamento Criança e Adolescente',
    desc: 'Recursos que garantem direitos de crianças e adolescentes (Constituição de 1988 e ECA).',
    lei: 'Lei estadual nº 3.762/2021',
    Icon: GraduationCapIcon,
    color: 'text-[#0e7490]',
    ring: 'border-[#0891b2]/30 bg-[#66d9ff]/10',
  },
  {
    name: 'OSG',
    full: 'Orçamento Sensível ao Gênero',
    desc: 'Recursos que promovem a igualdade entre mulheres e homens e enfrentam desigualdades históricas.',
    lei: 'Lei estadual nº 4.168/2023',
    Icon: VenusIcon,
    color: 'text-[#7c3aed]',
    ring: 'border-[#9333ea]/30 bg-[#c084fc]/10',
  },
  {
    name: 'Climático',
    full: 'Orçamento do Clima',
    desc: 'Recursos de mitigação e adaptação às mudanças climáticas, protegendo populações e a Amazônia.',
    lei: 'Lei estadual nº 4.679/2025',
    Icon: CloudSunIcon,
    color: 'text-[#047857]',
    ring: 'border-[#059669]/30 bg-[#34d399]/10',
  },
];

/* ------------------------------------------------------------------ */

type Slide = {
  kicker: string;
  nav: string;
  title: string;
  body: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    kicker: 'Boas-vindas',
    nav: 'Visão geral',
    title: 'O que são os Orçamentos Temáticos',
    body: (
      <div className="space-y-5">
        <p>
          Os orçamentos temáticos são <strong className="text-foreground">instrumentos de planejamento e
          transparência</strong> que identificam, dentro do orçamento do Estado do Acre, <strong className="text-foreground">
          quanto é investido</strong> em políticas prioritárias. Eles não criam novas despesas, dão visibilidade aos
          recursos já aplicados em cada tema, permitindo acompanhar, monitorar e avaliar essas políticas.
        </p>
        <p>
          Na prática, cada ação do orçamento é examinada para verificar se contribui para um desses temas e quanto
          dela conta para a política. Assim é possível medir o esforço real do Estado em cada agenda e prestar contas
          à sociedade e aos órgãos de controle. No Acre, são três os orçamentos temáticos:
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_CARDS.map(({ name, full, desc, lei, Icon, color, ring }) => (
            <div key={name} className={cn('flex flex-col rounded-xl border p-4', ring)}>
              <Icon className={cn('size-6', color)} />
              <p className="mt-2 text-base font-semibold text-foreground">{name}</p>
              <p className="text-xs font-medium text-foreground/70">{full}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{desc}</p>
              <p className="mt-2 text-[0.7rem] font-medium text-muted-foreground/80">{lei}</p>
            </div>
          ))}
        </div>
        <p className="text-sm">
          Nesta plataforma, o trabalho acontece em <strong className="text-foreground">3 etapas</strong>: classificar
          as ações nos temas, validar as entregas realizadas e enviar para a SEPLAN. Os próximos passos mostram cada
          uma — use o menu ao lado para navegar.
        </p>
      </div>
    ),
  },
  {
    kicker: 'Etapa 1',
    nav: 'Curadoria temática',
    title: 'Classifique cada ação',
    body: (
      <div className="grid items-center gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p>
            A curadoria é o ponto de partida: é aqui que você analisa as ações orçamentárias da sua unidade e indica
            <strong className="text-foreground"> quais delas contribuem</strong> para cada orçamento temático. Use os
            filtros de unidade, ação e tema para encontrar a ação e abra o formulário ao lado.
          </p>
          <p>Para classificar, informe:</p>
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-foreground">Tema</strong> — OCAD, OSG ou Climático.</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-foreground">Eixo</strong> — a frente da política em que a ação se enquadra dentro do tema.</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-foreground">Classificação</strong> — se a ação é exclusiva do tema ou contribui parcialmente.</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-foreground">Ponderador</strong> — quanto da dotação conta para o tema. Alguns são fixos (ex.: 36%); em outros casos você informa o percentual.</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span><strong className="text-foreground">Justificativa</strong> — opcional, para registrar o motivo da classificação.</span></li>
          </ul>
          <p className="text-sm">
            Ao clicar em <strong className="text-foreground">Classificar ação</strong>, ela passa a aparecer na aba
            Validar Entregas. Uma mesma ação pode entrar em mais de um tema — até um de cada (três no total) — e você
            pode remover a classificação enquanto não houver dados de validação preenchidos.
          </p>
        </div>
        <FigureFrame caption="Formulário de classificação da ação.">
          <div className="space-y-2.5">
            <MockField label="Tema" value="OSG" accent />
            <MockField label="Eixo" value="Autonomia econômica" />
            <MockField label="Classificação" value="Categoria 1" />
            <MockField label="Ponderador" value="100%" />
            <div className="pt-1">
              <MockButton>
                <CheckIcon className="size-3.5" />
                Classificar ação
              </MockButton>
            </div>
          </div>
        </FigureFrame>
      </div>
    ),
  },
  {
    kicker: 'Etapa 2',
    nav: 'Validar entregas',
    title: 'Registre o que foi entregue',
    body: (
      <div className="space-y-4">
        <p>
          Na aba <strong className="text-foreground">Validar Entregas</strong>, você conta o que a ação realizou de
          concreto. Cadastre <strong className="text-foreground">ao menos uma entrega</strong> — pode adicionar
          quantas precisar.
        </p>
        <FigureFrame caption="Cada entrega registra o que foi realizado e para quem.">
          <div className="rounded-lg border bg-background p-3.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <MockField label="Nome da entrega" value="Capacitação de servidoras" />
              <MockField label="Quantidade" value="120" />
              <MockField label="Município" value="Rio Branco" />
              <MockField label="Público beneficiado" value="Servidoras públicas" />
            </div>
            <div className="mt-2.5 space-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">Descrição</span>
              <div className="rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm text-foreground/80">
                Curso de qualificação realizado em parceria com a escola de governo.
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <MockButton subtle>
                <PlusIcon className="size-3.5" />
                Adicionar entrega
              </MockButton>
              <MockButton subtle>Salvar rascunho</MockButton>
            </div>
          </div>
        </FigureFrame>
        <p className="text-sm">
          Pode salvar como <strong className="text-foreground">rascunho</strong> e continuar depois — nada é enviado
          até você decidir.
        </p>
      </div>
    ),
  },
  {
    kicker: 'Etapa 3',
    nav: 'Enviar à SEPLAN',
    title: 'Envie para a SEPLAN',
    body: (
      <div className="space-y-5">
        <p>
          Quando as validações estiverem completas, use <strong className="text-foreground">Enviar para SEPLAN</strong>{' '}
          para submeter todas de uma vez. Acompanhe a situação de cada ação ao longo do caminho:
        </p>
        <FigureFrame caption="A situação avança conforme a ação é enviada e analisada.">
          <div className="flex flex-wrap items-center justify-center gap-3 py-2">
            <MockBadge tone="rascunho">Rascunho</MockBadge>
            <ArrowRightIcon className="size-4 text-muted-foreground" />
            <MockBadge tone="enviado">Enviado</MockBadge>
            <ArrowRightIcon className="size-4 text-muted-foreground" />
            <MockBadge tone="aprovado">Aprovado</MockBadge>
          </div>
          <div className="mt-3 flex justify-center">
            <MockButton>
              <SendIcon className="size-3.5" />
              Enviar para SEPLAN
            </MockButton>
          </div>
        </FigureFrame>
        <p className="text-sm">
          <strong className="text-foreground">Rascunho</strong> é o que ainda está em preenchimento;{' '}
          <strong className="text-foreground">Enviado</strong> aguarda a análise da SEPLAN; e{' '}
          <strong className="text-foreground">Aprovado</strong> é a validação concluída.
        </p>
      </div>
    ),
  },
  {
    kicker: 'Ajustes',
    nav: 'Correções',
    title: 'Se a SEPLAN pedir correções',
    body: (
      <div className="grid items-center gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <p>
            Às vezes a SEPLAN devolve uma ação para ajustes. Quando isso acontece, ela volta a ficar como{' '}
            <strong className="text-foreground">Rascunho</strong> e editável.
          </p>
          <ol className="space-y-2">
            <li className="flex gap-2"><span className="font-semibold text-primary">1.</span><span>Leia o <strong className="text-foreground">Comentário da SEPLAN</strong> no card da ação.</span></li>
            <li className="flex gap-2"><span className="font-semibold text-primary">2.</span><span>Faça os ajustes pedidos na classificação ou nas entregas.</span></li>
            <li className="flex gap-2"><span className="font-semibold text-primary">3.</span><span><strong className="text-foreground">Reenvie</strong> para a SEPLAN.</span></li>
          </ol>
          <p className="text-sm">
            Precisou de ajuda? O botão <strong className="text-foreground">Ajuda</strong>, no topo da tela, traz o guia
            completo a qualquer momento.
          </p>
        </div>
        <FigureFrame caption="O comentário orienta exatamente o que ajustar.">
          <div className="rounded-lg border bg-background p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Capacitação de servidoras</span>
              <MockBadge tone="rascunho">Rascunho</MockBadge>
            </div>
            <div className="mt-3 flex gap-2 rounded-md border border-primary/25 bg-primary/5 p-2.5">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-xs">
                <p className="font-semibold text-foreground">Comentário da SEPLAN</p>
                <p className="text-muted-foreground">Revise o público beneficiado e detalhe melhor a entrega 2.</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <MockButton>
                <SendIcon className="size-3.5" />
                Reenviar
              </MockButton>
            </div>
          </div>
        </FigureFrame>
      </div>
    ),
  },
];

export function SecretariaOnboardingSlides({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const total = SLIDES.length;
  const slide = SLIDES[index];
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        onFinish();
        return i;
      }
      return i + 1;
    });
  }, [total, onFinish]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, total - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    },
    [total],
  );

  return (
    <div
      className="flex min-h-[calc(100vh-13rem)] w-full flex-col gap-5 outline-none"
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Apresentação: como o sistema funciona"
    >
      {/* Palco do slide */}
      <div className="grid flex-1 overflow-hidden rounded-2xl border shadow-sm md:grid-cols-[minmax(210px,24%)_minmax(0,1fr)]">
        {/* Painel da marca — sumário das etapas */}
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0d4a2b] via-primary to-primary/80 p-6 text-primary-foreground lg:p-7">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-60 rounded-full bg-emerald-300/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />

          <span className="relative text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-primary-foreground/60">
            Como funciona
          </span>

          <nav className="relative flex flex-col gap-1.5" aria-label="Etapas">
            {SLIDES.map((s, i) => {
              const active = i === index;
              const done = i < index;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={active}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                    active
                      ? 'bg-primary-foreground/15 ring-1 ring-primary-foreground/20'
                      : 'hover:bg-primary-foreground/10',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                      active
                        ? 'bg-primary-foreground text-primary'
                        : done
                          ? 'bg-primary-foreground/25 text-primary-foreground'
                          : 'bg-primary-foreground/10 text-primary-foreground/70',
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'truncate text-sm transition-colors',
                      active ? 'font-semibold text-primary-foreground' : 'text-primary-foreground/70 group-hover:text-primary-foreground/90',
                    )}
                  >
                    {s.nav}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="relative">
            <div className="mb-2 flex items-center justify-between text-xs text-primary-foreground/60">
              <span>Passo {index + 1} de {total}</span>
              <span>{Math.round(((index + 1) / total) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/15">
              <div
                className="h-full rounded-full bg-primary-foreground/80 transition-all duration-300 ease-out"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Painel de conteúdo */}
        <div className="flex flex-col justify-center overflow-y-auto bg-card p-8 lg:p-12">
          <div key={`content-${index}`} className="animate-in fade-in slide-in-from-right-4 duration-300 ease-out">
            <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">{slide.title}</h2>
            <div className="mt-5 text-base leading-relaxed text-muted-foreground">{slide.body}</div>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={prev} disabled={isFirst}>
          <ChevronLeftIcon data-icon="inline-start" />
          Anterior
        </Button>

        <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para o slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-primary' : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
            />
          ))}
        </div>

        <Button onClick={next}>
          {isLast ? (
            <>
              <PlayIcon data-icon="inline-start" />
              Começar
            </>
          ) : (
            <>
              Próximo
              <ChevronRightIcon data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  UserCheckIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/domain/badges';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LEGISLATION_LINKS, statusLabels } from '@/lib/api';
import { lockedWeightingFactorLabel } from '@/lib/classification-rules';
import type { ValidationStatus } from '@/types/domain';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'introducao', title: '1. Introdução' },
  { id: 'acesso', title: '2. Acesso e interface' },
  { id: 'curadoria', title: '3. Curadoria temática' },
  { id: 'regras', title: '4. Regras metodológicas' },
  { id: 'validacao', title: '5. Validar Entregas' },
  { id: 'status', title: '6. Status e envios' },
  { id: 'revisao', title: '7. Revisão interna' },
  { id: 'faq', title: '8. Boas práticas e FAQ' },
  { id: 'glossario', title: '9. Glossário' },
] as const;

const THEME_AXES = {
  OCAD: ['Educação', 'Saúde', 'Assistência Social'],
  OSG: [
    'Assistência Social e Direitos Humanos',
    'Educação',
    'Saúde',
    'Segurança',
    'Econômico',
    'Governança',
  ],
  CLIMATICO: [
    'Desenvolvimento sustentável e bioeconomia',
    'Mitigação das mudanças climáticas',
    'Adaptação climática',
    'Justiça climática e inclusão social',
    'Governança ambiental e transparência',
    'Educação ambiental e inovação',
    'Gestão de riscos e proteção civil',
  ],
} as const;

const THEME_CLASSIFICATIONS = {
  OCAD: ['Exclusivo', 'Não exclusivo'],
  OSG: [
    'Categoria 1 — dotação exclusiva para mulheres',
    'Categoria 2 — dotação genérica estratégica',
    'Categoria 3 — dotação genérica não estratégica',
  ],
  CLIMATICO: ['Exclusiva', 'Não Exclusivo'],
} as const;

const STATUS_ROWS: Array<{ status: ValidationStatus; description: string }> = [
  { status: 'RASCUNHO', description: 'Em preenchimento pelo Representante.' },
  { status: 'ENVIADO_REVISOR', description: 'Enviado ao Revisor interno para análise.' },
  { status: 'DEVOLVIDO_REVISOR', description: 'Devolvido pelo Revisor para correção.' },
  { status: 'APROVADO_REVISOR', description: 'Aprovado internamente; pronto para envio à SEPLAN.' },
  { status: 'ENVIADO', description: 'Enviado à SEPLAN para revisão final.' },
  { status: 'DEVOLVIDO', description: 'Devolvido pela SEPLAN para correção.' },
  { status: 'APROVADO', description: 'Aprovado pela SEPLAN.' },
];

const EDITABLE_STATUSES: ValidationStatus[] = ['RASCUNHO', 'DEVOLVIDO', 'DEVOLVIDO_REVISOR'];

function ProfileBadge({ profile }: { profile: 'representante' | 'revisor' | 'ambos' }) {
  if (profile === 'ambos') {
    return (
      <div className="flex flex-wrap gap-2 not-prose">
        <Badge variant="outline" className="border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <UserCheckIcon className="size-3.5" data-icon="inline-start" />
          Representante
        </Badge>
        <Badge variant="outline" className="border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
          <ShieldCheckIcon className="size-3.5" data-icon="inline-start" />
          Revisor interno
        </Badge>
      </div>
    );
  }
  if (profile === 'revisor') {
    return (
      <Badge variant="outline" className="not-prose border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
        <ShieldCheckIcon className="size-3.5" data-icon="inline-start" />
        Revisor interno
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="not-prose border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      <UserCheckIcon className="size-3.5" data-icon="inline-start" />
      Representante
    </Badge>
  );
}

function Callout({
  variant,
  title,
  children,
}: {
  variant: 'atencao' | 'dica';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'not-prose rounded-lg border px-4 py-3 text-sm',
        variant === 'atencao' && 'border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100',
        variant === 'dica' && 'border-cyan-600/40 bg-cyan-500/10 text-cyan-950 dark:text-cyan-100',
      )}
    >
      <p className="mb-1 font-semibold">{title}</p>
      <div className="text-muted-foreground [&_strong]:text-inherit">{children}</div>
    </div>
  );
}

function HelpTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="not-prose overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionContent({ id }: { id: (typeof SECTIONS)[number]['id'] }) {
  switch (id) {
    case 'introducao':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="ambos" />
          <p>
            A plataforma <strong className="text-foreground">Orçamentos Temáticos</strong> apoia o acompanhamento e a
            validação das ações orçamentárias classificadas nos três orçamentos temáticos do Estado do Acre:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">OCAD</strong> — Orçamento Criança e Adolescente
            </li>
            <li>
              <strong className="text-foreground">OSG</strong> — Orçamento Sensível ao Gênero
            </li>
            <li>
              <strong className="text-foreground">Climático</strong> — Orçamento do Clima
            </li>
          </ul>
          <p>
            A secretaria executiva consome a base orçamentária vigente preparada pela SEPLAN. A secretaria{' '}
            <strong className="text-foreground">não importa QDD</strong> nem administra usuários.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-3">
              <p className="mb-1 text-sm font-semibold text-emerald-800 dark:text-emerald-300">Representante</p>
              <p className="text-xs">
                Classifica ações, preenche validações e envia respostas para revisão interna e SEPLAN.
              </p>
            </div>
            <div className="rounded-lg border border-blue-600/30 bg-blue-500/5 p-3">
              <p className="mb-1 text-sm font-semibold text-blue-800 dark:text-blue-300">Revisor interno</p>
              <p className="text-xs">
                Corresponde sempre ao gestor ou secretário da secretaria. Analisa validações enviadas, aprova ou
                devolve com comentário. O envio à SEPLAN é do Representante.
              </p>
            </div>
          </div>
          <Callout variant="atencao" title="Atenção">
            Este guia descreve <strong>apenas os campos e fluxos visíveis na interface atual</strong>. Campos como
            status da execução ou upload de evidências podem ser incorporados futuramente.
          </Callout>
        </div>
      );

    case 'acesso':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="ambos" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Login e perfis</h4>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Acesse <code className="rounded bg-muted px-1 py-0.5 text-xs">/login</code> com credenciais fornecidas
                  pela SEPLAN.
                </li>
                <li>
                  Perfis <code className="rounded bg-muted px-1 py-0.5 text-xs">SECRETARIA_REPRESENTANTE</code> e{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">SECRETARIA_REVISOR</code> são direcionados para{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">/secretaria</code>.
                </li>
                <li>Demais perfis são redirecionados para a área SEPLAN.</li>
              </ol>
              <h4 className="font-semibold text-foreground">Cabeçalho</h4>
              <p>
                O cabeçalho exibe logotipo, título, botão <strong className="text-foreground">Legislação</strong> (links
                oficiais), contadores de validações e classificações, e <strong className="text-foreground">Sair</strong>.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Legislação</p>
                <ul className="space-y-1">
                  {LEGISLATION_LINKS.map((item) => (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      >
                        {item.label}
                        <ExternalLinkIcon className="size-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <HelpTable
                headers={['Perfil', 'Abas / tela', 'Ações em lote']}
                rows={[
                  [
                    'Representante',
                    'Curadoria temática; Validar Entregas',
                    'Enviar p/ Revisão Interna; Enviar p/ SEPLAN',
                  ],
                  ['Revisor interno', 'Revisão de Entregas', 'Aprovar Tudo; Devolver p/ Correção'],
                ]}
              />
            </div>
          </div>
        </div>
      );

    case 'curadoria':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="representante" />
          <p>
            Na aba <strong className="text-foreground">Curadoria temática</strong>, classifique ações do QDD vigente
            atribuídas à sua unidade.
          </p>
          <h4 className="font-semibold text-foreground">Filtros da listagem</h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Unidade</strong> — filtra por código da unidade orçamentária
            </li>
            <li>
              <strong className="text-foreground">Ação ou programa</strong> — busca em aplicação, programa funcional e
              projeto/atividade
            </li>
            <li>
              <strong className="text-foreground">Tema</strong> — filtra ações com classificação OCAD, OSG ou Climático
            </li>
          </ul>
          <p>Cada linha exibe valores Inicial, Atualizado e Liquidado. Expanda para ver fontes de recurso.</p>
          <h4 className="font-semibold text-foreground">Formulário de classificação</h4>
          <HelpTable
            headers={['Campo', 'Descrição']}
            rows={[
              ['Tema', 'OCAD, OSG ou Climático'],
              ['Eixo', 'Conforme o tema (Seção 4)'],
              ['Classificação', 'Conforme o tema (Seção 4)'],
              ['Ponderador', 'Quando aplicável; regras na Seção 4'],
              ['Justificativa', 'Opcional'],
            ]}
          />
          <p>
            Clique em <strong className="text-foreground">Classificar ação</strong>. Uma validação em{' '}
            <StatusBadge status="RASCUNHO" /> é criada automaticamente na aba Validar Entregas.
          </p>
          <Callout variant="dica" title="Dica">
            Cada ação pode receber até uma classificação por tema (até três temas distintos por ação).
          </Callout>
          <h4 className="font-semibold text-foreground">Remoção de classificação</h4>
          <p>
            Use <strong className="text-foreground">Remover classificação</strong> para excluir classificações
            selecionadas. A remoção só é permitida quando não existem validações com dados preenchidos; o sistema
            informará o motivo do bloqueio.
          </p>
        </div>
      );

    case 'regras':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="representante" />
          <h4 className="font-semibold text-foreground">Ponderadores</h4>
          <HelpTable
            headers={['Tema', 'Classificação', 'Ponderador', 'Comportamento']}
            rows={[
              ['OCAD', 'Exclusivo', '1 (100%)', lockedWeightingFactorLabel('OCAD', 'EXCLUSIVO') ?? 'Fixo'],
              ['OCAD', 'Não exclusivo', 'Informado', 'Valor entre 0 e 1'],
              ['OSG', 'Categoria 1', '1 (100%)', lockedWeightingFactorLabel('OSG', 'CATEGORIA_1') ?? 'Fixo'],
              [
                'OSG',
                'Categoria 2',
                '—',
                lockedWeightingFactorLabel('OSG', 'CATEGORIA_2') ?? 'Valores por entrega',
              ],
              ['OSG', 'Categoria 3', '0,5 (50%)', lockedWeightingFactorLabel('OSG', 'CATEGORIA_3') ?? 'Fixo'],
              ['Climático', 'Exclusiva', '1 (100%)', lockedWeightingFactorLabel('CLIMATICO', 'EXCLUSIVA') ?? 'Fixo'],
              [
                'Climático',
                'Não Exclusivo',
                '—',
                lockedWeightingFactorLabel('CLIMATICO', 'INDIRETA') ?? 'Valores por entrega',
              ],
            ]}
          />
          <Callout variant="atencao" title="Atenção">
            Para OSG Categoria 2, informe o <strong>Valor Executado na Ação</strong> em cada entrega na validação; o
            total é calculado automaticamente.
          </Callout>
          <h4 className="font-semibold text-foreground">Classificações e eixos</h4>
          <div className="grid gap-3 lg:grid-cols-3">
            {(Object.keys(THEME_CLASSIFICATIONS) as Array<keyof typeof THEME_CLASSIFICATIONS>).map((theme) => (
              <Card key={theme} className="not-prose shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{theme === 'CLIMATICO' ? 'Climático' : theme}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-xs">
                  <div>
                    <p className="mb-1 font-semibold text-foreground">Classificações</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {THEME_CLASSIFICATIONS[theme].map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 font-semibold text-foreground">Eixos</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {THEME_AXES[theme].map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );

    case 'validacao':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="representante" />
          <p>
            Na aba <strong className="text-foreground">Validar Entregas</strong>, selecione uma ação na lista{' '}
            <em>Ações recebidas</em> e preencha o formulário à direita.
          </p>
          <Callout variant="dica" title="Dica">
            Ao trocar de ação, alterações não salvas ficam em cache local. Salve o rascunho antes de enviar em lote.
          </Callout>
          <h4 className="font-semibold text-foreground">Etapa 1 — Entregas realizadas</h4>
          <HelpTable
            headers={['Campo', 'Obrigatório', 'Observação']}
            rows={[
              ['Nome da entrega', 'Sim', ''],
              ['Descrição', 'Sim', 'Mínimo de 3 caracteres'],
              ['Quantidade', 'Sim', 'Número ≥ 0'],
              ['Município', 'Sim', 'Lista dos municípios do Acre'],
              ['Público beneficiado', 'Sim', ''],
              ['Valor Executado na Ação', 'Condicional', 'Obrigatório > 0 apenas para OSG Categoria 2'],
            ]}
          />
          <p>Cadastre ao menos uma entrega. É possível adicionar várias e remover extras (mantendo ao menos uma).</p>
          <h4 className="font-semibold text-foreground">Etapa 2 — Informações complementares</h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Valor executado informado</strong> — quando não é OSG Categoria 2
            </li>
            <li>
              <strong className="text-foreground">Total das entregas</strong> — soma automática para OSG Categoria 2
            </li>
            <li>
              <strong className="text-foreground">Observações</strong> — opcional
            </li>
          </ul>
          <p>
            Use <strong className="text-foreground">Salvar rascunho</strong> para persistir sem alterar o status
            (habilitado apenas nos status editáveis — Seção 6).
          </p>
        </div>
      );

    case 'status':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="representante" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Status das validações</h4>
              <div className="not-prose overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Significado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATUS_ROWS.map((row) => (
                      <tr key={row.status} className="border-b last:border-0">
                        <td className="px-3 py-2 align-top">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 align-top">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong className="text-foreground">Formulário editável</strong> (Representante):{' '}
                {EDITABLE_STATUSES.map((s) => statusLabels[s]).join(', ')}.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Fluxo resumido</h4>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs">
                <li>Classificar ação → validação em Rascunho</li>
                <li>Preencher e salvar → Enviar para Revisão Interna</li>
                <li>Revisor aprova ou devolve</li>
                <li>Se aprovado → Enviar para SEPLAN</li>
                <li>SEPLAN aprova ou devolve</li>
              </ol>
              <h4 className="font-semibold text-foreground">Ações em lote (Representante)</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-foreground">Enviar para Revisão Interna</strong> — Rascunho, Devolvido ou
                  Devolvido pelo Revisor (completas)
                </li>
                <li>
                  <strong className="text-foreground">Enviar para SEPLAN</strong> — Aprovado pelo Revisor
                </li>
                <li>
                  <strong className="text-foreground">Pendências</strong> — popover com campos incompletos
                </li>
              </ul>
            </div>
          </div>
        </div>
      );

    case 'revisao':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="revisor" />
          <p>
            O Revisor interno é sempre o <strong className="text-foreground">gestor ou secretário</strong> da
            secretaria. Acessa apenas <strong className="text-foreground">Revisão de Entregas</strong> (sem Curadoria
            temática).
          </p>
          <h4 className="font-semibold text-foreground">Revisão item a item</h4>
          <p>
            Com validação em <StatusBadge status="ENVIADO_REVISOR" /> selecionada:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Aprovar</strong> → status Aprovado pelo Revisor
            </li>
            <li>
              <strong className="text-foreground">Devolver</strong> → comentário obrigatório → Devolvido pelo Revisor
            </li>
          </ul>
          <p>Comentários da SEPLAN e do Revisor aparecem em alertas no topo do painel.</p>
          <h4 className="font-semibold text-foreground">Ações em lote</h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Aprovar Tudo</strong> — todas aguardando revisão interna
            </li>
            <li>
              <strong className="text-foreground">Devolver para Correção</strong> — justificativa obrigatória para o
              lote
            </li>
          </ul>
          <Callout variant="atencao" title="Atenção">
            O envio à SEPLAN é feito <strong>posteriormente pelo Representante</strong>, após aprovação interna.
          </Callout>
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <ProfileBadge profile="ambos" />
          <h4 className="font-semibold text-foreground">Ordem recomendada</h4>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Classifique ações na Curadoria temática</li>
            <li>Preencha validações em Validar Entregas</li>
            <li>Salve rascunhos frequentemente</li>
            <li>Envie para Revisão Interna</li>
            <li>Após aprovação do Revisor, envie para SEPLAN</li>
          </ol>
          <h4 className="font-semibold text-foreground">Após devolução</h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Devolvido pelo Revisor</strong> — leia o comentário, corrija e
              reenvie para revisão interna
            </li>
            <li>
              <strong className="text-foreground">Devolvido</strong> (SEPLAN) — leia o comentário da SEPLAN, corrija e
              reenvie
            </li>
          </ul>
          <h4 className="font-semibold text-foreground">Perguntas frequentes</h4>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-foreground">Por que não vejo todas as ações do estado?</dt>
              <dd>Você visualiza apenas ações das unidades sob sua responsabilidade (controle de acesso por unidade).</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Por que não consigo remover uma classificação?</dt>
              <dd>Existem validações com dados preenchidos vinculados. Esvazie ou conclua antes de remover.</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Preciso abrir um ciclo de validação?</dt>
              <dd>Não. O ciclo é criado automaticamente ao classificar. Abertura de ciclos é da SEPLAN.</dd>
            </div>
            <div>
              <dt className="font-semibold text-foreground">Onde está o campo de status da execução?</dt>
              <dd>
                A interface atual registra entregas, valores e observações. Outros campos podem ser adicionados no
                futuro.
              </dd>
            </div>
          </dl>
        </div>
      );

    case 'glossario':
      return (
        <dl className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="font-semibold text-foreground">QDD</dt>
            <dd>Quadro de Detalhamento da Despesa — base orçamentária importada pela SEPLAN.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Ação orçamentária</dt>
            <dd>Programa ou projeto/atividade do QDD; unidade de curadoria e validação.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Entrega</dt>
            <dd>Registro do realizado no âmbito de uma ação (Etapa 1 do formulário).</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Ponderador</dt>
            <dd>Fator entre 0 e 1 que pondera o valor da ação no orçamento temático.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Classificação temática</dt>
            <dd>Vínculo de ação a tema, eixo e categoria metodológica.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Ciclo de validação</dt>
            <dd>Período de acompanhamento; criado automaticamente ao classificar.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Validação</dt>
            <dd>Formulário de entregas e valores associado a uma classificação.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Representante</dt>
            <dd>Perfil SECRETARIA_REPRESENTANTE — curadoria, preenchimento e envios.</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Revisor interno</dt>
            <dd>
              Perfil SECRETARIA_REVISOR — gestor ou secretário da secretaria; revisão e devolução interna.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">SEPLAN</dt>
            <dd>Secretaria de Planejamento — importação do QDD e revisão final.</dd>
          </div>
        </dl>
      );

    default:
      return null;
  }
}

function HelpTocNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Sumário" className={cn('sticky top-6 h-fit', className)}>
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpenIcon className="size-4" />
            Sumário
          </CardTitle>
          <CardDescription className="text-xs">Navegue pelas seções</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="flex flex-col gap-0.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronRightIcon className="size-3.5 shrink-0 opacity-60" />
                  <span className="leading-snug">{section.title.replace(/^\d+\.\s*/, '')}</span>
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </nav>
  );
}

function HelpAside({ className }: { className?: string }) {
  return (
    <aside aria-label="Referência rápida" className={cn('sticky top-6 flex h-fit flex-col space-y-5', className)}>
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Fluxo resumido</CardTitle>
          <CardDescription className="text-xs">Do preenchimento à SEPLAN</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ol className="flex flex-col gap-2 text-xs text-muted-foreground">
            {[
              'Classificar ação na curadoria',
              'Preencher entregas e salvar rascunho',
              'Enviar para Revisão Interna',
              'Revisor aprova ou devolve',
              'Enviar para SEPLAN após aprovação',
            ].map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold tabular-nums text-primary">
                  {index + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Perfis de acesso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0 text-xs text-muted-foreground">
          <div className="rounded-lg border border-emerald-600/25 bg-emerald-500/5 p-3">
            <ProfileBadge profile="representante" />
            <p className="mt-2 leading-relaxed">
              Curadoria temática, validação de entregas e envios em lote.
            </p>
          </div>
          <div className="rounded-lg border border-blue-600/25 bg-blue-500/5 p-3">
            <ProfileBadge profile="revisor" />
            <p className="mt-2 leading-relaxed">
              Sempre o gestor ou secretário da secretaria. Revisão interna, aprovação ou devolução com comentário
              obrigatório.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Status editáveis</CardTitle>
          <CardDescription className="text-xs">Representante pode alterar o formulário</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5 pt-0">
          {EDITABLE_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Legislação</CardTitle>
          <CardDescription className="text-xs">Documentos oficiais da SEPLAN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {LEGISLATION_LINKS.map((item) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLinkIcon className="mt-0.5 size-3.5 shrink-0" />
              <span className="leading-snug">{item.label}</span>
            </a>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}

function DesktopSection({ id, title }: { id: (typeof SECTIONS)[number]['id']; title: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border border-border/60 bg-card/40 p-5 shadow-sm md:p-6 xl:p-7">
      <h2 className="mb-5 border-b border-border/60 pb-3 text-xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <SectionContent id={id} />
    </section>
  );
}

export function SecretariaHelpContent() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-6">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <GraduationCapIcon className="size-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">Ajuda</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Guia da Secretaria</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Orientações para Representantes e Revisores internos da plataforma Orçamentos Temáticos.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/secretaria">
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar para a plataforma
          </Link>
        </Button>
      </div>

      <div className="lg:hidden">
        <Accordion type="multiple" className="flex flex-col gap-2">
          {SECTIONS.map((section) => (
            <AccordionItem key={section.id} value={section.id} className="rounded-lg border px-4">
              <AccordionTrigger className="text-sm font-semibold">{section.title}</AccordionTrigger>
              <AccordionContent>
                <SectionContent id={section.id} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="hidden lg:grid lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(240px,300px)] xl:gap-8 2xl:gap-10">
        <HelpTocNav />

        <div className="flex min-w-0 flex-col gap-8 pb-10 xl:gap-10">
          {SECTIONS.map((section) => (
            <DesktopSection key={section.id} id={section.id} title={section.title} />
          ))}
        </div>

        <HelpAside className="hidden xl:block" />
      </div>
    </div>
  );
}

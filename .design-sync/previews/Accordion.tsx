import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  StatusBadge,
} from 'orcamentos-tematicos';

const orgs = [
  {
    code: '721',
    name: 'Secretaria de Estado de Saúde',
    sent: 3,
    total: 5,
    pending: 2,
    counts: { RASCUNHO: 2, ENVIADO: 2, APROVADO: 1 },
    items: [
      { activity: '2231', application: 'Atenção Especializada em Saúde da Mulher', status: 'ENVIADO' },
      { activity: '2240', application: 'Vigilância em Saúde Ambiental', status: 'ENVIADO' },
      { activity: '2215', application: 'Manutenção das Unidades de Pronto Atendimento', status: 'APROVADO' },
    ],
  },
  {
    code: '762',
    name: 'Secretaria de Estado da Mulher',
    sent: 4,
    total: 4,
    pending: 0,
    counts: { RASCUNHO: 0, ENVIADO: 0, APROVADO: 4 },
    items: [],
  },
] as const;

export const Padrao = () => (
  <Accordion type="multiple" defaultValue={['2026-721']} className="flex flex-col gap-3" style={{ width: '100%', maxWidth: '26rem' }}>
    {orgs.map((org) => (
      <AccordionItem key={org.code} value={`2026-${org.code}`}>
        <AccordionTrigger>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-3 pr-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">
                {org.code} - {org.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {org.sent} de {org.total} enviadas
                {org.pending > 0 ? ` · ${org.pending} pendentes de revisão` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {org.pending > 0 ? <Badge>{org.pending} a revisar</Badge> : null}
              {(['RASCUNHO', 'ENVIADO', 'APROVADO'] as const)
                .filter((s) => org.counts[s] > 0)
                .map((s) => (
                  <span key={s} className="flex items-center gap-1.5 text-xs">
                    <StatusBadge status={s} />
                    <span className="font-semibold tabular-nums">{org.counts[s]}</span>
                  </span>
                ))}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-2">
            {org.items.map((item) => (
              <li key={item.activity} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{item.application}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{item.activity}</p>
                </div>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

const help = [
  {
    id: 'introducao',
    title: '1. Introdução',
    text: 'Os orçamentos temáticos identificam, no QDD, as ações que financiam políticas para crianças e adolescentes (OCAD), para mulheres (OSG) e para o clima.',
  },
  { id: 'validacao', title: '5. Validar Entregas', text: '' },
  {
    id: 'status',
    title: '6. Status e envios',
    text: 'Rascunho, Enviado e Aprovado. Uma validação devolvida pela SEPLAN volta a aparecer como Rascunho.',
  },
];

export const AjudaDaSecretaria = () => (
  <Accordion type="multiple" defaultValue={['validacao']} className="flex flex-col gap-2" style={{ width: '100%', maxWidth: '26rem' }}>
    {help.map((section) => (
      <AccordionItem key={section.id} value={section.id} className="rounded-lg border px-4">
        <AccordionTrigger className="text-sm font-semibold">{section.title}</AccordionTrigger>
        <AccordionContent>
          {section.id === 'validacao' ? (
            <div className="flex flex-col gap-2 leading-relaxed">
              <p>
                Para cada ação recebida, cadastre as entregas realizadas no período: nome, quantidade,
                municípios atendidos e público beneficiado.
              </p>
              <p className="text-muted-foreground">
                Salve o rascunho a qualquer momento. O envio à SEPLAN só é liberado quando todas as
                entregas estão completas.
              </p>
            </div>
          ) : (
            <p className="leading-relaxed">{section.text}</p>
          )}
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

export const TodosFechados = () => (
  <Accordion type="single" collapsible className="flex flex-col gap-3" style={{ width: '100%', maxWidth: '26rem' }}>
    <AccordionItem value="2025">
      <AccordionTrigger>
        <div className="flex flex-1 items-center justify-between gap-3 pr-2">
          <p className="text-sm font-semibold">Exercício 2025</p>
          <span className="text-xs text-muted-foreground tabular-nums">38 validações</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>Validações do exercício 2025.</AccordionContent>
    </AccordionItem>
    <AccordionItem value="2026">
      <AccordionTrigger>
        <div className="flex flex-1 items-center justify-between gap-3 pr-2">
          <p className="text-sm font-semibold">Exercício 2026</p>
          <span className="text-xs text-muted-foreground tabular-nums">52 validações</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>Validações do exercício 2026.</AccordionContent>
    </AccordionItem>
  </Accordion>
);

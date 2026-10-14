import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Input,
  MoneyInput,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'orcamentos-tematicos';
import { EraserIcon } from 'lucide-react';

// Classe que o formulário de validação da secretaria aplica aos campos (validation-form.tsx).
const campo = 'border-black focus-visible:border-black focus-visible:ring-2 focus-visible:ring-gray-300';

type Entrega = {
  nome: string;
  quantidade: string;
  municipios: string;
  publico: string;
  descricao: string;
  valor: number | null;
};

function EntregaCard({ entrega, erros }: { entrega: Entrega; erros?: Partial<Record<keyof Entrega, string>> }) {
  const e = erros ?? {};
  return (
    <div className="overflow-hidden rounded-lg border border-black bg-card" style={{ width: '100%', maxWidth: '26rem' }}>
      <header className="flex items-center justify-between gap-2 border-b border-black bg-marca px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-black bg-background px-1.5 text-xs font-bold tabular-nums text-foreground">
            1
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-marca-contraste">Entrega</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-marca-contraste hover:bg-black/10 hover:text-marca-contraste"
        >
          <EraserIcon className="size-4" data-icon="inline-start" />
          Limpar campos
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-3 p-3">
        <Field className="col-span-2" data-invalid={!!e.nome || undefined}>
          <FieldLabel htmlFor="f-nome">Nome da entrega</FieldLabel>
          <Input id="f-nome" className={campo} placeholder="Nome da Entrega" defaultValue={entrega.nome} />
          <FieldError errors={[e.nome ? { message: e.nome } : undefined]} />
        </Field>
        <Field data-invalid={!!e.quantidade || undefined}>
          <FieldLabel htmlFor="f-qtd">Quantidade</FieldLabel>
          <Input id="f-qtd" className={campo} type="number" min={0} defaultValue={entrega.quantidade} />
          <FieldError errors={[e.quantidade ? { message: e.quantidade } : undefined]} />
        </Field>
        <Field data-invalid={!!e.valor || undefined}>
          <FieldLabel htmlFor="f-valor">Valor Executado na Ação</FieldLabel>
          <MoneyInput id="f-valor" className={campo} value={entrega.valor} />
          <FieldError errors={[e.valor ? { message: e.valor } : undefined]} />
        </Field>
        <Field className="col-span-2" data-invalid={!!e.municipios || undefined}>
          <FieldLabel htmlFor="f-mun">Municípios</FieldLabel>
          <Button
            id="f-mun"
            type="button"
            variant="outline"
            className="h-8 w-full justify-start overflow-hidden border-black bg-background px-3 text-left font-normal"
          >
            <span className="truncate">{entrega.municipios || 'Selecione os municípios'}</span>
          </Button>
          <FieldError errors={[e.municipios ? { message: e.municipios } : undefined]} />
        </Field>
        <Field className="col-span-2" data-invalid={!!e.publico || undefined}>
          <FieldLabel htmlFor="f-publico">Público beneficiado</FieldLabel>
          <Input
            id="f-publico"
            className={campo}
            placeholder="Ex.: Estudantes da rede pública de ensino"
            defaultValue={entrega.publico}
          />
          <FieldError errors={[e.publico ? { message: e.publico } : undefined]} />
        </Field>
        <Field className="col-span-2" data-invalid={!!e.descricao || undefined}>
          <FieldLabel htmlFor="f-desc">Descrição</FieldLabel>
          <Textarea id="f-desc" className={campo} rows={2} defaultValue={entrega.descricao} />
          <FieldError errors={[e.descricao ? { message: e.descricao } : undefined]} />
        </Field>
      </div>
    </div>
  );
}

export const EntregaDaSecretaria = () => (
  <EntregaCard
    entrega={{
      nome: 'Atendimentos na Casa da Mulher Brasileira',
      quantidade: '1250',
      municipios: 'Rio Branco, Cruzeiro do Sul',
      publico: 'Mulheres em situação de violência doméstica',
      descricao: 'Acolhimento psicossocial e orientação jurídica às mulheres atendidas no 2º quadrimestre.',
      valor: 412380,
    }}
  />
);

export const ComErro = () => (
  <EntregaCard
    entrega={{ nome: '', quantidade: '0', municipios: '', publico: '', descricao: 'Ok', valor: null }}
    erros={{
      nome: 'Informe o nome da entrega.',
      municipios: 'Selecione ao menos um município.',
      publico: 'Informe o público beneficiado.',
      descricao: 'Descrição deve ter pelo menos 3 caracteres.',
    }}
  />
);

export const ImportarQdd = () => (
  <FieldGroup style={{ maxWidth: '22rem' }}>
    <Field>
      <FieldLabel>Exercício</FieldLabel>
      <Select defaultValue="2026">
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione o exercício" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="2025">
              <span className="tabular-nums">2025</span>
            </SelectItem>
            <SelectItem value="2026">
              <span className="tabular-nums">2026</span>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
    <Field>
      <FieldLabel>Tipo de período</FieldLabel>
      <Select defaultValue="ACUMULADO_ANUAL">
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="ACUMULADO_ANUAL">Acumulado anual (jan a X)</SelectItem>
            <SelectItem value="MES_ISOLADO">Mês isolado</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
    <Field>
      <FieldLabel>Mês de referência (até)</FieldLabel>
      <Select defaultValue="8">
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="7">Julho</SelectItem>
            <SelectItem value="8">Agosto</SelectItem>
            <SelectItem value="9">Setembro</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>A prévia pode ser conferida na aba Conferência com QDD antes de confirmar.</FieldDescription>
    </Field>
  </FieldGroup>
);

const temas = [
  { id: 'tema-ocad', title: 'Orçamento Criança e Adolescente', desc: 'Políticas para crianças e adolescentes.', checked: true, disabled: false },
  { id: 'tema-osg', title: 'Orçamento Sensível ao Gênero', desc: 'Políticas para mulheres e equidade de gênero.', checked: false, disabled: false },
  { id: 'tema-clima', title: 'Orçamento Climático do Estado do Acre', desc: 'Mitigação e adaptação às mudanças do clima.', checked: true, disabled: true },
];

export const ConjuntoDeTemas = () => (
  <FieldSet style={{ maxWidth: '26rem' }}>
    <FieldLegend>Temas da ação</FieldLegend>
    <FieldDescription>Marque os orçamentos temáticos que a ação 2231 financia. Cada ação aceita até três temas.</FieldDescription>
    <FieldGroup data-slot="checkbox-group">
      {temas.map((t) => (
        <Field key={t.id} orientation="horizontal" data-disabled={t.disabled || undefined}>
          <Checkbox id={t.id} defaultChecked={t.checked} disabled={t.disabled} />
          <FieldContent>
            <FieldTitle>{t.title}</FieldTitle>
            <FieldDescription>{t.desc}</FieldDescription>
          </FieldContent>
        </Field>
      ))}
    </FieldGroup>
  </FieldSet>
);

export const CuradoriaComSeparador = () => (
  <FieldGroup style={{ maxWidth: '22rem' }}>
    <Field data-disabled>
      <FieldLabel htmlFor="f-ponderador">Ponderador</FieldLabel>
      <Input id="f-ponderador" type="text" inputMode="decimal" defaultValue="1" disabled />
      <FieldDescription>Dotação exclusiva: 100% do valor do programa (ponderador fixo em 1).</FieldDescription>
    </Field>
    <FieldSeparator />
    <Field>
      <FieldLabel htmlFor="f-justificativa">
        Justificativa <span className="font-normal text-muted-foreground">(opcional)</span>
      </FieldLabel>
      <Textarea
        id="f-justificativa"
        defaultValue="Ação integralmente voltada ao enfrentamento da violência contra a mulher."
      />
    </Field>
  </FieldGroup>
);

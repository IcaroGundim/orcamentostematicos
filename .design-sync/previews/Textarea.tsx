import { Field, FieldError, FieldLabel, Textarea } from 'orcamentos-tematicos';

export const Padrao = () => (
  <Field style={{ width: '100%', maxWidth: '24rem' }}>
    <FieldLabel htmlFor="ta-desc">Descrição do que foi realizado</FieldLabel>
    <Textarea
      id="ta-desc"
      rows={3}
      placeholder="Detalhe o produto, serviço ou atendimento, incluindo o alcance quando relevante."
    />
  </Field>
);

export const Preenchido = () => (
  <Field style={{ width: '100%', maxWidth: '24rem' }}>
    <FieldLabel htmlFor="ta-just">
      Justificativa <span className="font-normal text-muted-foreground">(opcional)</span>
    </FieldLabel>
    <Textarea
      id="ta-just"
      defaultValue="Ação integralmente voltada ao enfrentamento da violência contra a mulher: manutenção da Casa da Mulher Brasileira e dos centros de referência em Rio Branco e Cruzeiro do Sul."
    />
  </Field>
);

export const ComErro = () => (
  <Field data-invalid style={{ width: '100%', maxWidth: '24rem' }}>
    <FieldLabel htmlFor="ta-erro">Descrição</FieldLabel>
    <Textarea id="ta-erro" rows={2} defaultValue="Ok" aria-invalid />
    <FieldError>Descrição deve ter pelo menos 3 caracteres.</FieldError>
  </Field>
);

export const Desabilitado = () => (
  <Field data-disabled style={{ width: '100%', maxWidth: '24rem' }}>
    <FieldLabel htmlFor="ta-desab">Descrição</FieldLabel>
    <Textarea
      id="ta-desab"
      rows={2}
      disabled
      defaultValue="Distribuição de 500 kits escolares a estudantes da rede estadual em Tarauacá e Feijó."
    />
  </Field>
);

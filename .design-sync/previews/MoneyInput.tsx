import { Field, FieldDescription, FieldError, FieldLabel, MoneyInput } from 'orcamentos-tematicos';

export const Preenchido = () => (
  <Field style={{ width: '18rem' }}>
    <FieldLabel htmlFor="mi-valor">Valor executado nesta entrega</FieldLabel>
    <MoneyInput id="mi-valor" value={412380} />
  </Field>
);

export const Vazio = () => (
  <Field style={{ width: '18rem' }}>
    <FieldLabel htmlFor="mi-vazio">Valor Executado na Ação</FieldLabel>
    <MoneyInput id="mi-vazio" value={null} />
    <FieldDescription>Digite apenas números; os centavos entram pela direita.</FieldDescription>
  </Field>
);

export const ComErro = () => (
  <Field data-invalid style={{ width: '18rem' }}>
    <FieldLabel htmlFor="mi-erro">Valor Executado na Ação</FieldLabel>
    <MoneyInput id="mi-erro" value={0} aria-invalid />
    <FieldError>Informe um valor maior que zero.</FieldError>
  </Field>
);

export const Desabilitado = () => (
  <Field data-disabled style={{ width: '18rem' }}>
    <FieldLabel htmlFor="mi-desab">Valor executado informado</FieldLabel>
    <MoneyInput id="mi-desab" value={48312900} disabled />
    <FieldDescription>Validação enviada; aguardando revisão da SEPLAN.</FieldDescription>
  </Field>
);

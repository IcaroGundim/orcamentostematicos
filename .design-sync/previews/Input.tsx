import { Field, FieldError, FieldLabel, Input } from 'orcamentos-tematicos';
import { SearchIcon } from 'lucide-react';

export const Padrao = () => (
  <div className="flex flex-col gap-3" style={{ width: '22rem' }}>
    <Input placeholder="E-mail ou nome de usuário" />
    <Input defaultValue="Atendimentos na Casa da Mulher Brasileira" />
  </div>
);

export const ComIconeDeBusca = () => (
  <div className="relative min-w-0" style={{ width: '22rem' }}>
    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Buscar ação, programa funcional..." className="w-full min-w-0 pl-9" />
  </div>
);

export const Tipos = () => (
  <div className="flex flex-col gap-4" style={{ width: '22rem' }}>
    <Field>
      <FieldLabel htmlFor="in-senha">Senha</FieldLabel>
      <Input id="in-senha" type="password" defaultValue="senhadeexemplo" autoComplete="off" />
    </Field>
    <Field>
      <FieldLabel htmlFor="in-qtd">Quantidade</FieldLabel>
      <Input id="in-qtd" type="number" min={0} step={1} defaultValue={1250} className="tabular-nums" />
    </Field>
    <Field>
      <FieldLabel htmlFor="in-ponderador">Ponderador</FieldLabel>
      <Input id="in-ponderador" type="text" inputMode="decimal" placeholder="Opcional" />
    </Field>
  </div>
);

export const Estados = () => (
  <div className="flex flex-col gap-4" style={{ width: '22rem' }}>
    <Field data-disabled>
      <FieldLabel htmlFor="in-desab">Ponderador (fixo)</FieldLabel>
      <Input id="in-desab" defaultValue="0,36" disabled />
    </Field>
    <Field data-invalid>
      <FieldLabel htmlFor="in-invalido">Nome da entrega</FieldLabel>
      <Input id="in-invalido" aria-invalid placeholder="Nome da Entrega" />
      <FieldError>Informe o nome da entrega.</FieldError>
    </Field>
  </div>
);

import {
  Field,
  FieldError,
  FieldLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'orcamentos-tematicos';

// Célula exibida no cartão (cardMode single): o filtro de tema aberto. O cartão sem
// ?story= renderiza sem margem do body; o padding próprio evita cortar o anel do gatilho.
export const Aberto = () => (
  <div style={{ width: '16rem', padding: '1.5rem', boxSizing: 'content-box' }}>
    <Select defaultOpen defaultValue="OSG">
      <SelectTrigger className="w-full min-w-0">
        <SelectValue placeholder="Tema" />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectItem value="ALL">Todos os temas</SelectItem>
          <SelectItem value="OCAD">OCAD</SelectItem>
          <SelectItem value="OSG">OSG</SelectItem>
          <SelectItem value="CLIMATICO">Climático</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);

export const AbertoComGrupos = () => (
  <div style={{ width: '24rem' }}>
    <Select defaultOpen defaultValue="721201">
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>721 - Secretaria de Estado de Saúde</SelectLabel>
          <SelectItem value="721101">
            <span className="font-mono text-xs text-muted-foreground">721101</span> Secretaria de Estado de Saúde
          </SelectItem>
          <SelectItem value="721201">
            <span className="font-mono text-xs text-muted-foreground">721201</span> Fundo Estadual de Saúde
          </SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>762 - Secretaria de Estado da Mulher</SelectLabel>
          <SelectItem value="762101">
            <span className="font-mono text-xs text-muted-foreground">762101</span> Secretaria de Estado da Mulher
          </SelectItem>
          <SelectItem value="762301" disabled>
            <span className="font-mono text-xs text-muted-foreground">762301</span> Fundo Estadual de Políticas para as Mulheres
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);

export const Fechado = () => (
  <div className="flex flex-col gap-3" style={{ width: '16rem' }}>
    <Select defaultValue="ACUMULADO_ANUAL">
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ACUMULADO_ANUAL">Acumulado anual (jan a X)</SelectItem>
        <SelectItem value="MES_ISOLADO">Mês isolado</SelectItem>
      </SelectContent>
    </Select>
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecione o exercício" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="2025">2025</SelectItem>
        <SelectItem value="2026">2026</SelectItem>
      </SelectContent>
    </Select>
    <Select defaultValue="xlsx">
      <SelectTrigger size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
        <SelectItem value="csv">CSV (.csv)</SelectItem>
        <SelectItem value="json">JSON (.json)</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Estados = () => (
  <div className="flex flex-col gap-4" style={{ width: '16rem' }}>
    <Field data-disabled>
      <FieldLabel>Tema</FieldLabel>
      <Select defaultValue="OCAD" disabled>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="OCAD">OCAD</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field data-invalid>
      <FieldLabel>Exercício</FieldLabel>
      <Select>
        <SelectTrigger className="w-full" aria-invalid>
          <SelectValue placeholder="Selecione o exercício" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2026">2026</SelectItem>
        </SelectContent>
      </Select>
      <FieldError>Selecione o exercício do QDD.</FieldError>
    </Field>
  </div>
);

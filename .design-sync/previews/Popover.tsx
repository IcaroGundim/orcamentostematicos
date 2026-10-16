import {
  Button,
  Checkbox,
  Field,
  FieldLabel,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'orcamentos-tematicos';
import { DownloadIcon } from 'lucide-react';

const municipios = [
  'Acrelândia',
  'Assis Brasil',
  'Brasiléia',
  'Bujari',
  'Capixaba',
  'Cruzeiro do Sul',
  'Epitaciolândia',
  'Feijó',
  'Jordão',
];
const selecionados = ['Brasiléia', 'Cruzeiro do Sul'];

// Célula exibida no cartão (cardMode single): o seletor de municípios aberto,
// como no formulário de validação da secretaria.
// O cartão sem ?story= renderiza sem margem do body; o padding próprio evita que o
// rótulo e o gatilho encostem na borda.
export const Aberto = () => (
  <div style={{ padding: '1.5rem' }}>
  <Field style={{ width: '20rem' }}>
    <FieldLabel htmlFor="pop-municipios">Municípios</FieldLabel>
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button
          id="pop-municipios"
          type="button"
          variant="outline"
          className="h-8 w-full justify-start overflow-hidden border-black bg-background px-3 text-left font-normal"
        >
          <span className="truncate">{selecionados.join(', ')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="max-h-64 overflow-y-auto">
          {municipios.map((name) => {
            const id = `pop-mun-${name}`;
            return (
              <div key={name} className="flex items-center gap-2 rounded-md px-2.5 py-2">
                <Checkbox id={id} defaultChecked={selecionados.includes(name)} />
                <Label htmlFor={id} className="font-normal">
                  {name}
                </Label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  </Field>
  </div>
);

export const Exportacao = () => (
  <div className="flex justify-end" style={{ width: '36rem' }}>
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 border-black bg-white shadow-none hover:bg-stone-100">
          <DownloadIcon data-icon="inline-start" />
          Exportar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Formato</Label>
          <Select defaultValue="xlsx">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
              <SelectItem value="json">JSON (.json)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="w-full">
          <DownloadIcon />
          Exportar recorte filtrado
        </Button>
      </PopoverContent>
    </Popover>
  </div>
);

export const Fechado = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className="shrink-0 border-black bg-white shadow-none hover:bg-stone-100">
        <DownloadIcon data-icon="inline-start" />
        Exportar
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-72">
      Exportação do recorte filtrado.
    </PopoverContent>
  </Popover>
);

import { Checkbox, Input, Label } from 'orcamentos-tematicos';

export const ComInput = () => (
  <div className="flex flex-col gap-2" style={{ width: '22rem' }}>
    <Label htmlFor="lb-identificador">E-mail ou nome de usuário</Label>
    <Input id="lb-identificador" placeholder="semulher" />
  </div>
);

export const ComComplemento = () => (
  <div className="flex flex-col gap-2" style={{ width: '22rem' }}>
    <Label htmlFor="lb-obs">
      Observações <span className="font-normal text-muted-foreground">(opcional)</span>
    </Label>
    <Input id="lb-obs" />
  </div>
);

export const ComCheckbox = () => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <Checkbox id="lb-lembrar" defaultChecked />
      <Label htmlFor="lb-lembrar">Salvar atalho neste dispositivo</Label>
    </div>
    <div className="flex items-center gap-2">
      <Checkbox id="lb-emendas" />
      <Label htmlFor="lb-emendas">Incluir emendas parlamentares</Label>
    </div>
  </div>
);

export const Desabilitado = () => (
  <div className="flex items-center gap-2">
    <Checkbox id="lb-desab" disabled />
    <Label htmlFor="lb-desab">Incluir exercício comparativo (2025)</Label>
  </div>
);

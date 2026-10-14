import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'orcamentos-tematicos';

export const Padrao = () => (
  <Card className="w-[26rem]">
    <CardHeader>
      <CardTitle>Ações recebidas</CardTitle>
      <CardDescription>Selecione uma ação para preencher a validação.</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <p>12 ações aguardam validação da Secretaria de Estado de Educação.</p>
      <p className="text-muted-foreground">Prazo do ciclo: 30/09/2026.</p>
    </CardContent>
    <CardFooter className="justify-end gap-2 border-t py-3">
      <Button variant="outline">Ver todas</Button>
      <Button>Começar</Button>
    </CardFooter>
  </Card>
);

export const CabecalhoClaroComAcao = () => (
  <Card className="w-[34rem]">
    <CardHeader className="bg-card text-card-foreground [&_[data-slot=card-title]]:text-card-foreground [&_[data-slot=card-description]]:text-muted-foreground">
      <CardTitle>MELHORIA, MODERNIZAÇÃO E INOVAÇÃO DA REDE ESTADUAL DE ENSINO.</CardTitle>
      <CardDescription>10400000 | SECRETARIA DE ESTADO DA EDUCAÇÃO, CULTURA E ESPORTES - SEE</CardDescription>
      <CardAction className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-medium">
          Exclusivo
        </Badge>
        <Badge variant="secondary">Em preenchimento</Badge>
      </CardAction>
    </CardHeader>
    <CardContent className="grid grid-cols-3 gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Dotação atualizada
        </span>
        <span className="font-semibold tabular-nums">R$ 48.312.900,00</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Liquidado
        </span>
        <span className="font-semibold tabular-nums">R$ 31.074.518,42</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Execução
        </span>
        <span className="font-semibold tabular-nums">64,3%</span>
      </div>
    </CardContent>
  </Card>
);

export const Compacto = () => (
  <Card size="sm" className="w-[22rem]">
    <CardHeader>
      <CardTitle>Entregas pendentes</CardTitle>
      <CardDescription>Ciclo do 3º quadrimestre</CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-3xl font-bold tabular-nums">27</p>
      <p className="text-muted-foreground">entregas sem município informado</p>
    </CardContent>
  </Card>
);

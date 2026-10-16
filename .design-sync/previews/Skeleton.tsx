import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'orcamentos-tematicos';

const kpis = ['Dotação inicial', 'Dotação atualizada', 'Empenhado', 'Liquidado', 'Pago', 'Disponível'];

export const KpisCarregando = () => (
  <dl className="grid w-[44rem] grid-cols-3 overflow-hidden border border-black/70 bg-white">
    {kpis.map((label) => (
      <div key={label} className="min-w-0 border-b border-r border-black/20 px-3 py-2.5">
        <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
        <Skeleton className="mt-1 h-6 w-24" />
      </div>
    ))}
  </dl>
);

export const LinhasDeTabela = () => (
  <div className="w-[44rem] border border-black/70 bg-white">
    <Table>
      <TableHeader className="bg-stone-50">
        <TableRow className="border-b border-black/70">
          <TableHead className="min-w-[16rem]">Secretaria</TableHead>
          <TableHead className="text-right">Ações</TableHead>
          <TableHead className="text-right">Liquidado</TableHead>
          <TableHead className="text-right">Execução</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[0, 1, 2, 3, 4].map((row) => (
          <TableRow key={row} className="odd:bg-stone-50/60">
            <TableCell>
              <Skeleton className="h-4" style={{ width: `${[78, 64, 86, 58, 72][row]}%` }} />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-16" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const Cartao = () => (
  <Card className="w-[26rem]">
    <CardHeader>
      <CardTitle>Execução por secretaria</CardTitle>
      <CardDescription>Carregando o QDD vigente do exercício 2026…</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Skeleton className="w-full" style={{ height: '10rem' }} />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    </CardContent>
  </Card>
);

export const Pagina = () => (
  <div className="flex w-[44rem] flex-col gap-4 bg-white p-6">
    <Skeleton className="h-16 w-full" />
    <Skeleton className="w-full" style={{ height: '18rem' }} />
  </div>
);

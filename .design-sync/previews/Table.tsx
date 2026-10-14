import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from 'orcamentos-tematicos';
import { CheckCircle2Icon } from 'lucide-react';

const rows = [
  { key: '0710', label: 'Secretaria de Estado de Educação', count: 142, updated: 'R$ 612.480.000,00', committed: 'R$ 498.312.540,18', liquidated: 'R$ 401.118.207,55', rate: '65,5%' },
  { key: '0810', label: 'Secretaria de Estado de Saúde', count: 118, updated: 'R$ 548.920.300,00', committed: 'R$ 471.006.882,31', liquidated: 'R$ 352.774.109,86', rate: '64,3%' },
  { key: '0910', label: 'Secretaria de Estado de Infraestrutura', count: 64, updated: 'R$ 287.114.650,00', committed: 'R$ 190.442.018,77', liquidated: 'R$ 98.315.260,40', rate: '34,2%' },
  { key: '1010', label: 'Polícia Militar do Estado do Acre', count: 57, updated: 'R$ 221.708.000,00', committed: 'R$ 176.390.425,62', liquidated: 'R$ 149.882.301,09', rate: '67,6%' },
  { key: '1110', label: 'Secretaria de Estado de Meio Ambiente', count: 23, updated: 'R$ 48.312.900,00', committed: 'R$ 29.884.105,20', liquidated: 'R$ 17.402.366,91', rate: '36,0%' },
  { key: '1310', label: 'Secretaria de Estado da Mulher', count: 11, updated: 'R$ 9.870.000,00', committed: 'R$ 6.112.408,50', liquidated: 'R$ 4.035.772,18', rate: '40,9%' },
];

export const ExecucaoPorSecretaria = () => (
  <div className="border border-black/70 bg-white" style={{ width: '54rem' }}>
    <div className="max-h-[26rem] overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-stone-50">
          <TableRow className="border-b border-black/70">
            <TableHead className="min-w-[16rem]">Secretaria</TableHead>
            <TableHead className="text-right">Ações</TableHead>
            <TableHead className="text-right">Dotação atualizada</TableHead>
            <TableHead className="text-right">Empenhado</TableHead>
            <TableHead className="text-right font-semibold text-foreground">Liquidado</TableHead>
            <TableHead className="text-right">Execução</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="odd:bg-stone-50/60">
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">{row.count}</TableCell>
              <TableCell className="text-right tabular-nums">{row.updated}</TableCell>
              <TableCell className="text-right tabular-nums">{row.committed}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{row.liquidated}</TableCell>
              <TableCell className="text-right tabular-nums">{row.rate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export const ComTotais = () => (
  <div className="border border-black/70 bg-white" style={{ width: '54rem' }}>
    <Table>
      <TableCaption className="mb-3">Exercício 2026 · acumulado de janeiro a agosto · fonte: QDD do SICAF.</TableCaption>
      <TableHeader className="bg-stone-50">
        <TableRow className="border-b border-black/70">
          <TableHead className="min-w-[16rem]">Secretaria</TableHead>
          <TableHead className="text-right">Ações</TableHead>
          <TableHead className="text-right">Dotação atualizada</TableHead>
          <TableHead className="text-right font-semibold text-foreground">Liquidado</TableHead>
          <TableHead className="text-right">Execução</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 4).map((row) => (
          <TableRow key={row.key} className="odd:bg-stone-50/60">
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
            <TableCell className="text-right tabular-nums">{row.updated}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{row.liquidated}</TableCell>
            <TableCell className="text-right tabular-nums">{row.rate}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">381</TableCell>
          <TableCell className="text-right tabular-nums">R$ 1.670.222.950,00</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">R$ 1.002.089.878,90</TableCell>
          <TableCell className="text-right tabular-nums">60,0%</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
);

const exercises = [
  { year: 2026, isCurrent: true, comparisonOnly: false },
  { year: 2025, isCurrent: false, comparisonOnly: true },
  { year: 2024, isCurrent: false, comparisonOnly: false },
];

export const Exercicios = () => (
  <div className="w-[44rem] bg-white">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Exercício</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {exercises.map((exercise) => (
          <TableRow key={exercise.year}>
            <TableCell className="font-medium tabular-nums">{exercise.year}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                {exercise.isCurrent ? (
                  <Badge>
                    <CheckCircle2Icon data-icon="inline-start" />
                    Corrente
                  </Badge>
                ) : null}
                {exercise.comparisonOnly ? <Badge variant="secondary">Apenas comparativo</Badge> : null}
                {!exercise.isCurrent && !exercise.comparisonOnly ? (
                  <span className="text-xs text-muted-foreground">Exercício completo</span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={exercise.isCurrent || exercise.comparisonOnly}>
                  Tornar corrente
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={exercise.isCurrent}>
                  {exercise.comparisonOnly ? 'Tornar completo' : 'Marcar comparativo'}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

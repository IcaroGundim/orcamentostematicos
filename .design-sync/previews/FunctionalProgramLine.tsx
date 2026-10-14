import { FunctionalProgramLine, ThemeBadge } from 'orcamentos-tematicos';

// "Função Programática" do QDD: função (2) + subfunção (3) + programa (4) + projeto/atividade (8),
// sem separadores (o parser remove o apóstrofo de texto do Excel). O componente destaca o
// projeto/atividade quando ele fecha a string.

export const Padrao = () => (
  <FunctionalProgramLine functionalProgram="12362101010400000" projectActivity="10400000" />
);

export const ComTemas = () => (
  <div className="flex flex-col gap-1" style={{ width: '36rem' }}>
    <p className="text-sm font-semibold leading-snug">
      PROMOÇÃO DO MEIO AMBIENTE E CIDADES SUSTENTÁVEIS E RESILIENTES.
    </p>
    <FunctionalProgramLine functionalProgram="18541103411200000" projectActivity="11200000">
      <ThemeBadge theme="OSG" />
      <ThemeBadge theme="CLIMATICO" />
    </FunctionalProgramLine>
  </div>
);

export const NaListaDeCuradoria = () => (
  <div className="flex flex-col gap-0.5 border border-black/20 bg-card px-3 py-2.5" style={{ width: '26rem' }}>
    <p className="break-words text-base font-semibold leading-snug text-primary">
      FORTALECIMENTO DO SISTEMA SOCIOEDUCATIVO.
    </p>
    <FunctionalProgramLine
      functionalProgram="14243104210070000"
      projectActivity="10070000"
      className="truncate text-[11px] font-medium leading-4 text-muted-foreground"
    />
  </div>
);

export const SemProjetoAtividade = () => (
  <FunctionalProgramLine functionalProgram="123681010" projectActivity="" />
);

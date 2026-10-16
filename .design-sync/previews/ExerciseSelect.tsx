import { ExerciseSelect } from 'orcamentos-tematicos';

const exercicios = [
  { year: 2026, comparisonOnly: false, isCurrent: true },
  { year: 2025, comparisonOnly: true, isCurrent: false },
];

const semAcao = () => {};

export const NoCabecalho = () => (
  <header className="border-b border-black bg-marca text-marca-contraste" style={{ width: '44rem' }}>
    <div className="flex h-16 items-center justify-between gap-4 px-4">
      <span className="truncate font-semibold uppercase tracking-widest" style={{ fontSize: '22px' }}>
        Execução Orçamentária
      </span>
      <ExerciseSelect exercises={exercicios} year={2026} onChange={semAcao} />
    </div>
  </header>
);

export const Padrao = () => <ExerciseSelect exercises={exercicios} year={2026} onChange={semAcao} />;

export const ExercicioComparativo = () => (
  <ExerciseSelect exercises={exercicios} year={2025} onChange={semAcao} />
);

export const ExercicioUnico = () => (
  <ExerciseSelect
    exercises={[{ year: 2026, comparisonOnly: false, isCurrent: true }]}
    year={2026}
    onChange={semAcao}
  />
);

import { SummaryCountBadge } from 'orcamentos-tematicos';

export const Padrao = () => (
  <div className="flex flex-wrap items-center gap-2">
    <SummaryCountBadge count={23} label="validações" />
    <SummaryCountBadge count={31} label="classificações" />
  </div>
);

export const InicioDoCiclo = () => (
  <div className="flex flex-wrap items-center gap-2">
    <SummaryCountBadge count={0} label="validações" />
    <SummaryCountBadge count={0} label="classificações" />
  </div>
);

export const ContagemAlta = () => (
  <div className="flex flex-wrap items-center gap-2">
    <SummaryCountBadge count={148} label="validações" />
    <SummaryCountBadge count={1204} label="classificações" />
  </div>
);

import { CloudSunIcon, GraduationCapIcon, VenusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusLabels, themeLabels } from '@/lib/api';
import type { ThemeBudget, ValidationStatus } from '@/types/domain';

const themeBadgeClasses: Record<ThemeBudget, string> = {
  OSG: 'border-[#9333ea]/35 bg-[#c084fc]/22 text-[#5b21b6]',
  OCAD: 'border-[#0891b2]/35 bg-[#66d9ff]/22 text-[#0e7490]',
  CLIMATICO: 'border-[#065f46] bg-[#065f46] text-white',
};

/** Cor sólida da pílula de seleção por tema (HoverTabsList) — mesma família do ThemeBadge, em tom escuro. */
export const themePillClasses: Record<ThemeBudget, string> = {
  OSG: 'bg-[#2e1065]',
  OCAD: 'bg-[#0e7490]',
  CLIMATICO: 'bg-[#065f46]',
};

/** Cor do texto do item de seleção fora de destaque, por tema. */
export const themeTabIdleClasses: Record<ThemeBudget, string> = {
  OSG: 'text-[#1e0a3c] data-active:text-[#1e0a3c] hover:text-[#1e0a3c]',
  OCAD: 'text-[#164e63] data-active:text-[#164e63] hover:text-[#164e63]',
  CLIMATICO: 'text-[#065f46] data-active:text-[#065f46] hover:text-[#065f46]',
};

export function ThemeBadge({ theme, className }: { theme: ThemeBudget; className?: string }) {
  const Icon = theme === 'OCAD' ? GraduationCapIcon : theme === 'OSG' ? VenusIcon : CloudSunIcon;
  return (
    <Badge className={cn(themeBadgeClasses[theme], className)} variant="outline">
      <Icon data-icon="inline-start" />
      {themeLabels[theme]}
    </Badge>
  );
}

export function SummaryCountBadge({ count, label }: { count: number; label: string }) {
  return (
    <Badge
      variant="default"
      className="h-7 gap-2 rounded-[min(var(--radius-md),12px)] border-transparent px-3.5 text-[0.8rem] font-normal shadow-sm"
    >
      <span className="tabular-nums font-semibold leading-none">{count}</span>
      <span className="text-white uppercase tracking-wide">{label}</span>
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ValidationStatus }) {
  // Devolvido é exibido como Rascunho (o status interno permanece DEVOLVIDO).
  const display = status === 'DEVOLVIDO' ? 'RASCUNHO' : status;
  const variant =
    display === 'APROVADO' ? 'default' :
    display === 'ENVIADO' ? 'outline' :
    'secondary';
  return (
    <Badge
      variant={variant}
      className={display === 'RASCUNHO' ? 'bg-green-900 text-white hover:bg-green-900' : undefined}
    >
      {statusLabels[display]}
    </Badge>
  );
}

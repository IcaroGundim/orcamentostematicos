import { CloudSunIcon, GraduationCapIcon, VenusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusLabels, themeLabels } from '@/lib/api';
import type { ThemeBudget, ValidationStatus } from '@/types/domain';

const themeBadgeClasses: Record<ThemeBudget, string> = {
  OSG: 'border-[#9333ea]/35 bg-[#c084fc]/22 text-[#5b21b6]',
  OCAD: 'border-[#0891b2]/35 bg-[#66d9ff]/22 text-[#0e7490]',
  CLIMATICO: 'border-primary/20 bg-primary/10 text-primary',
};

export function ThemeBadge({ theme }: { theme: ThemeBudget }) {
  const Icon = theme === 'OCAD' ? GraduationCapIcon : theme === 'OSG' ? VenusIcon : CloudSunIcon;
  return (
    <Badge className={cn(themeBadgeClasses[theme])} variant="outline">
      <Icon data-icon="inline-start" />
      {themeLabels[theme]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ValidationStatus }) {
  const variant =
    status === 'APROVADO' ? 'default' :
    status === 'DEVOLVIDO' ? 'destructive' :
    status === 'ENVIADO' ? 'outline' :
    'secondary';
  return <Badge variant={variant}>{statusLabels[status]}</Badge>;
}

import { BabyIcon, CloudSunIcon, ShieldCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { statusLabels, themeLabels } from '@/lib/api';
import type { ThemeBudget, ValidationStatus } from '@/types/domain';

export function ThemeBadge({ theme }: { theme: ThemeBudget }) {
  const Icon = theme === 'OCAD' ? BabyIcon : theme === 'OSG' ? ShieldCheckIcon : CloudSunIcon;
  return (
    <Badge className="border-primary/20 bg-primary/10 text-primary" variant="outline">
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

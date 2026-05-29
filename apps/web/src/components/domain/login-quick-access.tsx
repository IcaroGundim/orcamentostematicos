'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  clearQuickAccessOnDevice,
  getQuickAccessEntries,
  hasLocalLoginHistory,
  roleBadge,
  type QuickAccessEntry,
} from '@/lib/local-quick-access';
import { cn } from '@/lib/utils';

interface LoginQuickAccessProps {
  disabled?: boolean;
  onQuickLogin: (identifier: string, password: string) => void;
}

export function LoginQuickAccess({ disabled, onQuickLogin }: LoginQuickAccessProps) {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<QuickAccessEntry[]>([]);

  useEffect(() => {
    setMounted(true);
    if (hasLocalLoginHistory()) {
      setEntries(getQuickAccessEntries());
    }
  }, []);

  function handleClear() {
    clearQuickAccessOnDevice();
    setEntries([]);
  }

  if (!mounted || !hasLocalLoginHistory() || entries.length === 0) {
    return null;
  }

  return (
    <>
      <Separator className="my-5" />

      <div className="mt-2 flex flex-col gap-2.5">
        <span className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Acesso rápido
        </span>

        <div className="grid grid-cols-2 gap-2">
          {entries.map((entry) => {
            const isSeplan = entry.role === 'SEPLAN_ADMIN';

            return (
              <button
                key={entry.identifier}
                type="button"
                disabled={disabled}
                onClick={() => onQuickLogin(entry.identifier, entry.password)}
                className={cn(
                  'flex text-left transition-all disabled:opacity-50',
                  isSeplan
                    ? 'col-span-2 items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 hover:border-primary/40 hover:bg-primary/10'
                    : 'flex-col rounded-lg border border-border bg-card p-2 hover:bg-muted',
                )}
              >
                <div className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      'truncate font-bold',
                      isSeplan ? 'text-[11px] text-primary' : 'text-[10px] text-foreground',
                    )}
                  >
                    {entry.name}
                  </span>
                  <span className="truncate text-[8px] text-muted-foreground">{entry.identifier}</span>
                  {entry.organizationCode ? (
                    <span className="truncate text-[8px] text-muted-foreground">{entry.organizationCode}</span>
                  ) : null}
                </div>
                <Badge
                  variant={isSeplan ? 'default' : 'outline'}
                  className={cn(
                    'shrink-0 uppercase',
                    isSeplan ? 'rounded px-1.5 py-0.5 text-[8px]' : 'mt-1 w-fit text-[8px]',
                  )}
                >
                  {roleBadge(entry.role)}
                </Badge>
              </button>
            );
          })}
        </div>

        <p className="text-center text-[9px] text-muted-foreground/80">
          Atalhos somem após 7 dias sem entrar com a conta.
        </p>

        <button
          type="button"
          className="self-center text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          onClick={handleClear}
        >
          Esquecer atalhos neste dispositivo
        </button>
      </div>
    </>
  );
}

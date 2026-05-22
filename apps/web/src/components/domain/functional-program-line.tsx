import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function functionalProgramPrefix(
  functionalProgram: string,
  projectActivity: string,
): string {
  const program = functionalProgram.trim();
  const activity = projectActivity.trim();
  if (!activity || !program.endsWith(activity)) {
    return program;
  }
  return program.slice(0, -activity.length);
}

export type FunctionalProgramLineProps = {
  functionalProgram: string;
  projectActivity: string;
  className?: string;
  title?: string;
  children?: ReactNode;
};

export function FunctionalProgramLine({
  functionalProgram,
  projectActivity,
  className,
  title,
  children,
}: FunctionalProgramLineProps) {
  const activity = projectActivity.trim();
  const program = functionalProgram.trim();
  const prefix = functionalProgramPrefix(program, activity);
  const hasSuffix = Boolean(activity && program.endsWith(activity));

  if (!activity) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)} title={title ?? program}>
        {program}
      </p>
    );
  }

  return (
    <p
      className={cn('flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground', className)}
      title={title ?? program}
    >
      {hasSuffix ? (
        prefix ? <span>{prefix}</span> : null
      ) : program ? (
        <span>{program}</span>
      ) : null}
      <Badge variant="secondary" className="shrink-0 font-mono text-xs">
        {activity}
      </Badge>
      {children}
    </p>
  );
}

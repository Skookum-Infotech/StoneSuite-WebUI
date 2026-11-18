import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="type-page-title">{title}</h1>
        {subtitle && <p className="mt-1 type-page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  color,
  className,
  size = 'default',
}: {
  children: ReactNode;
  color?: string;
  className?: string;
  size?: 'sm' | 'default';
}) {
  // When a hex color is provided (workflow state), tint with it; otherwise use a neutral chip.
  const style = color ? { backgroundColor: `${color}28`, color, borderColor: `${color}70` } : undefined;
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center rounded-full border whitespace-nowrap',
        size === 'sm'
          ? 'gap-1 px-1.5 py-px text-micro font-medium'
          : 'gap-1.5 px-2.5 py-0.5 type-pill',
        !color && 'border-stone-200 bg-stone-100 text-ink dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
        className,
      )}
    >
      {color && (
        <span
          className={cn('shrink-0 rounded-full', size === 'sm' ? 'size-1' : 'size-1.5')}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-sm text-ink-muted">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNote({
  children,
  role = 'alert',
  id,
}: {
  children: ReactNode;
  role?: 'alert' | 'status';
  id?: string;
}) {
  return (
    <div
      id={id}
      role={role}
      className="rounded-lg bg-red-50 px-3 py-2 type-error dark:bg-red-950/30">
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-ink-muted dark:border-stone-700">
      {children}
    </div>
  );
}

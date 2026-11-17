import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Used when a status has no color of its own (the stone-400 icon gray). */
const FALLBACK_COLOR = '#8a8580';

/**
 * A status chip tinted with the record's status color (DESIGN.md "Status
 * pill"): 12px medium text, a 10% tint background, text darkened from the
 * same color so it stays readable, and an optional leading dot.
 *
 * The color comes from data at runtime (workflow/status configuration), so
 * it is passed to the stylesheet as the `--pill` CSS variable — the one
 * inline style this component keeps; everything else lives in
 * styles/typography.css (`.status-pill`).
 */
export function StatusPill({ color, children, dot = true, className }: {
  color: string | null | undefined;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const style = { '--pill': color || FALLBACK_COLOR } as CSSProperties;
  return (
     
    <span className={cn('status-pill', dot && 'status-pill-dot', className)} style={style}>
      {children}
    </span>
  );
}

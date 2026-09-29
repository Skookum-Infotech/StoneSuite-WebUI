import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AllocationChipTone = 'order' | 'job';

// Colours follow the sidebar: sales orders are green, fabrication is orange, so
// the two read as the same records wherever they show up.
const TONE_CLASSES: Record<AllocationChipTone, string> = {
  order: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  job: 'border-orange-200 bg-orange-50 text-orange-700',
};

const HOVER_CLASSES: Record<AllocationChipTone, string> = {
  order: 'hover:bg-emerald-100',
  job: 'hover:bg-orange-100',
};

// One record a slab is allocated to. A link when the user may open that record,
// otherwise the same chip as plain text.
export function UnitAllocationChip({ icon: Icon, label, to, tone, ariaLabel }: {
  icon: LucideIcon;
  label: string;
  to?: string;
  tone: AllocationChipTone;
  ariaLabel: string;
}) {
  const classes = cn(
    'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-2xs font-semibold whitespace-nowrap',
    TONE_CLASSES[tone],
  );
  const content = (
    <>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );

  if (!to) return <span className={classes} aria-label={ariaLabel}>{content}</span>;
  return (
    <Link to={to} aria-label={ariaLabel} className={cn(classes, HOVER_CLASSES[tone], 'transition-colors')}>
      {content}
    </Link>
  );
}

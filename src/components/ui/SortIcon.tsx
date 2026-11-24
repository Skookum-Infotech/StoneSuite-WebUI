import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

interface SortIconProps {
  /** True when the table is currently sorted by this column. */
  active: boolean;
  dir: SortDirection;
}

/** Column-header sort indicator shared by every list table. */
export function SortIcon({ active, dir }: SortIconProps) {
  if (!active) return <ArrowUpDown className="size-2.5 opacity-40" aria-hidden="true" />;
  return dir === 'asc'
    ? <ArrowUp className="size-2.5" aria-hidden="true" />
    : <ArrowDown className="size-2.5" aria-hidden="true" />;
}

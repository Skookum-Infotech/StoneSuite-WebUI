import { cn } from '@/lib/utils';

/** Pill-style tab switcher (Cloudflare-like): a muted rounded track holding the tabs. */
export const TAB_LIST_CLASS =
  'inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-stone-200/70 bg-stone-100 p-1';

/** Spacing for the bar that hosts a `TAB_LIST_CLASS` track so it lines up with page gutters. */
export const TAB_BAR_CLASS = 'flex shrink-0 overflow-x-auto overflow-y-hidden bg-white py-2.5 modal-scrollbar';

const TAB_BASE_CLASS =
  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
const TAB_ACTIVE_CLASS = 'border-stone-200 bg-white text-stone-950 shadow-sm';
const TAB_INACTIVE_CLASS = 'border-transparent text-stone-500 hover:text-stone-800';

/** Class for a single tab button inside a `TAB_LIST_CLASS` track. */
export function tabClass(active: boolean): string {
  return cn(TAB_BASE_CLASS, active ? TAB_ACTIVE_CLASS : TAB_INACTIVE_CLASS);
}

import type { ReactNode } from 'react';

// Shared shell for every dashboard widget card. `h-full` lets a card fill
// whatever row height CSS Grid stretches it to, so a short card and a tall
// card placed side by side in the same row always end up the same height —
// regardless of which widgets a given user has allocated/enabled, or how
// much data each one has.
export function WidgetCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-stone-300 bg-card p-4 sm:p-[19px]">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2.5">
        <span className="text-[13.5px] font-bold text-stone-950">{title}</span>
        {subtitle && <span className="text-[11.5px] text-stone-500 sm:shrink-0">{subtitle}</span>}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

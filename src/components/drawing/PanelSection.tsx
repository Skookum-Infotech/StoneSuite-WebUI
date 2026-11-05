// A collapsible group in the side panels, so the tools stay reachable without
// a long scroll. Native <details>: keyboard and screen-reader support for free.

import type { ReactNode } from 'react';

export function PanelSection(
  { title, label, defaultOpen = true, children }: { title: string; label?: string; defaultOpen?: boolean; children: ReactNode },
) {
  return (
    <details open={defaultOpen} aria-label={label ?? title} className="group flex flex-col gap-1.5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-2xs font-semibold uppercase tracking-wide text-stone-500 [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-stone-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="mt-1.5 flex flex-col gap-1.5">{children}</div>
    </details>
  );
}

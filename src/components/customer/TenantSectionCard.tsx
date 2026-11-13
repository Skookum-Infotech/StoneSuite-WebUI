import type { ReactNode } from 'react';

/** A titled card on the customer detail page. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <h2 className="border-b border-stone-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

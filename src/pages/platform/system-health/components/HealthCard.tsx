import type { ReactNode } from 'react';

interface HealthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** The bordered card every System Health section sits in. */
export function HealthCard({ title, subtitle, children }: HealthCardProps) {
  return (
    <section
      aria-label={title}
      className="rounded-[10px] border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900"
    >
      <h2 className="text-sm font-semibold text-stone-950 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-stone-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

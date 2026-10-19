import type { ReactNode } from 'react';

interface DetailFieldProps {
  label: string;
  children: ReactNode;
}

// One label/value pair of a read-only order. A <dl> pair so a screen reader
// announces "Builder, Highland Homes" rather than two unrelated strings.
export function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="min-w-0">
      <dt className="text-label font-semibold uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-stone-900">{children}</dd>
    </div>
  );
}

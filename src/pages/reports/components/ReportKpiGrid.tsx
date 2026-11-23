export interface Kpi {
  label: string;
  value: string;
}

interface ReportKpiGridProps {
  items: Kpi[];
}

/** A responsive row of labelled headline numbers, shared by every report. */
export function ReportKpiGrid({ items }: ReportKpiGridProps) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Report totals">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <dt className="text-label font-medium text-stone-500">{k.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-stone-900">{k.value}</dd>
        </div>
      ))}
    </dl>
  );
}

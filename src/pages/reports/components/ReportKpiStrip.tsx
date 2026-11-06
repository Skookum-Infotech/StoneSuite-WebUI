import { formatMoney } from "@/lib/formatMoney";
import { formatPercent } from "@/lib/reportFormat";
import type { SalesTotals } from "@/types/reports";

interface ReportKpiStripProps {
  totals: SalesTotals;
  /** What the record count counts ("Invoices", "Sales orders"); omit to hide it. */
  recordsLabel?: string;
}

interface Kpi {
  label: string;
  value: string;
}

export function ReportKpiStrip({ totals, recordsLabel }: ReportKpiStripProps) {
  const kpis: Kpi[] = [
    { label: "Revenue", value: formatMoney(totals.revenue) },
    { label: "Cost", value: formatMoney(totals.cost) },
    { label: "Margin", value: formatMoney(totals.margin) },
    { label: "Margin %", value: formatPercent(totals.marginPercent) },
  ];
  if (recordsLabel) kpis.push({ label: recordsLabel, value: String(totals.records) });

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Report totals">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
          <dt className="text-label font-medium text-stone-500">{k.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-stone-900">{k.value}</dd>
        </div>
      ))}
    </dl>
  );
}

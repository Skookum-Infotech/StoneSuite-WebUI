import { formatMoney } from "@/lib/formatMoney";
import { formatPercent } from "@/lib/reportFormat";
import type { SalesTotals } from "@/types/reports";
import { ReportKpiGrid, type Kpi } from "./ReportKpiGrid";

interface ReportKpiStripProps {
  totals: SalesTotals;
  /** What the record count counts ("Invoices", "Sales orders"); omit to hide it. */
  recordsLabel?: string;
}

/** The Sales reports' revenue / cost / margin strip. */
export function ReportKpiStrip({ totals, recordsLabel }: ReportKpiStripProps) {
  const items: Kpi[] = [
    { label: "Revenue", value: formatMoney(totals.revenue) },
    { label: "Cost", value: formatMoney(totals.cost) },
    { label: "Margin", value: formatMoney(totals.margin) },
    { label: "Margin %", value: formatPercent(totals.marginPercent) },
  ];
  if (recordsLabel) items.push({ label: recordsLabel, value: String(totals.records) });
  return <ReportKpiGrid items={items} />;
}

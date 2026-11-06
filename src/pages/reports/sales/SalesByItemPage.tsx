import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatMoney } from "@/lib/formatMoney";
import { formatPercent, formatQuantity } from "@/lib/reportFormat";
import { itemReportTable } from "@/lib/salesReportTables";
import { reportsService } from "@/services/reportsService";
import type { SalesDrillSelector, SalesItemRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportDrillPanel } from "../components/ReportDrillPanel";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiStrip } from "../components/ReportKpiStrip";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";

const QUERY_KEY = "report-sales-by-item";
const FREE_TEXT_NOTE =
  "Only lines tied to an inventory item are listed; free-text lines are left out, so these totals can be lower than Sales by Customer.";

interface DrillTarget {
  title: string;
  selector: SalesDrillSelector;
}

const COLUMNS: ReportColumn<SalesItemRow>[] = [
  { key: "name", label: "Item", render: (r) => r.name },
  { key: "sku", label: "SKU", render: (r) => r.sku },
  { key: "quantity", label: "Quantity", align: "right", render: (r) => `${formatQuantity(r.quantity)} ${r.unit}`.trim() },
  { key: "revenue", label: "Revenue", align: "right", render: (r) => formatMoney(r.revenue) },
  { key: "avgPrice", label: "Avg price", align: "right", render: (r) => formatMoney(r.avgPrice) },
  { key: "cost", label: "Cost", align: "right", render: (r) => formatMoney(r.cost) },
  { key: "margin", label: "Margin", align: "right", render: (r) => formatMoney(r.margin) },
  { key: "marginPct", label: "Margin %", align: "right", render: (r) => (r.revenue > 0 ? formatPercent((r.margin / r.revenue) * 100) : "—") },
];

export default function SalesByItemPage() {
  const { state, actions, params } = useReportFilters();
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.salesByItem(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? itemReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.rows ?? []).map((r) => ({ label: r.name, revenue: r.revenue, margin: r.margin })),
    [q.data],
  );

  return (
    <ReportPageShell
      title="Sales by Item"
      description="What sells, how much of it, and at what margin. Select an item to see its records."
      backTo="/reports/sales"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} showBasis />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiStrip totals={q.data.totals} />
          <ReportTopBarChart data={chartData} label="Top items by revenue" />
          <ReportDataTable
            copy={{ caption: "Sales by item" }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => r.itemId}
            onRowClick={(r) => setDrill({ title: r.name, selector: { itemId: r.itemId } })}
          />
          <p className="text-label text-stone-500">{FREE_TEXT_NOTE}</p>
        </>
      )}
      {drill && (
        <ReportDrillPanel title={drill.title} params={params} selector={drill.selector} onClose={() => setDrill(null)} />
      )}
    </ReportPageShell>
  );
}

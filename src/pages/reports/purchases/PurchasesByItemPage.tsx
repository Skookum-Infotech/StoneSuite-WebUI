import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatMoney } from "@/lib/formatMoney";
import { formatCostChange, purchaseItemReportTable } from "@/lib/purchasesReportTables";
import { formatQuantity } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { PurchaseItemRow, PurchasesReportParams } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";

const QUERY_KEY = "report-purchases-by-item";
const NOTE =
  "Counts purchase orders sent to the vendor and dated in the period. Cost is the unit price on the order, net of tax and shipping. Cost change compares the first and last order in the period. Free-text lines with no inventory item are left out.";

const COLUMNS: ReportColumn<PurchaseItemRow>[] = [
  { key: "name", label: "Item", render: (r) => r.name },
  { key: "sku", label: "SKU", render: (r) => r.sku },
  { key: "ordered", label: "Qty ordered", align: "right", render: (r) => `${formatQuantity(r.quantity)} ${r.unit}`.trim() },
  { key: "received", label: "Qty received", align: "right", render: (r) => formatQuantity(r.received) },
  { key: "spend", label: "Spend", align: "right", render: (r) => formatMoney(r.spend) },
  { key: "avg", label: "Avg cost", align: "right", render: (r) => formatMoney(r.avgCost) },
  { key: "min", label: "Lowest", align: "right", render: (r) => formatMoney(r.minCost) },
  { key: "max", label: "Highest", align: "right", render: (r) => formatMoney(r.maxCost) },
  { key: "change", label: "Cost change", align: "right", render: (r) => formatCostChange(r.costChangePercent) },
];

export default function PurchasesByItemPage() {
  const { state, actions } = useReportFilters();
  const params = useMemo<PurchasesReportParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.purchasesByItem(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? purchaseItemReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.rows ?? []).map((r) => ({ label: r.name, revenue: r.spend, margin: 0 })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    return [
      { label: "Spend", value: formatMoney(q.data.totals.spend) },
      { label: "Items bought", value: String(q.data.totals.items) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Purchases by Item"
      description="What you buy, how much you spend on it, and how its cost moves."
      backTo="/reports/purchases"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportTopBarChart data={chartData} label="Top items by spend" names={{ primary: "Spend" }} />
          <ReportDataTable copy={{ caption: "Purchases by item" }} columns={COLUMNS} rows={q.data.rows} getRowKey={(r) => r.itemId} />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

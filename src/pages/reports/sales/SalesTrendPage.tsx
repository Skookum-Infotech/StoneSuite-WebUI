import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatMoney } from "@/lib/formatMoney";
import { formatPercent, formatPeriodLabel } from "@/lib/reportFormat";
import { BASIS_LABELS, trendReportTable } from "@/lib/salesReportTables";
import { reportsService } from "@/services/reportsService";
import type { SalesDrillSelector, SalesReportParams, SalesTrendRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportDrillPanel } from "../components/ReportDrillPanel";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiStrip } from "../components/ReportKpiStrip";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTrendChart } from "../components/ReportTrendChart";

const QUERY_KEY = "report-sales-trend";

interface DrillTarget {
  title: string;
  selector: SalesDrillSelector;
}

export default function SalesTrendPage() {
  const { state, actions, params: baseParams } = useReportFilters();
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  const bucket = state.bucket;
  const params = useMemo<SalesReportParams>(() => ({ ...baseParams, bucket }), [baseParams, bucket]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.salesTrend(params),
    placeholderData: (prev) => prev,
  });

  const columns = useMemo<ReportColumn<SalesTrendRow>[]>(
    () => [
      { key: "period", label: bucket === "week" ? "Week" : "Month", render: (r) => formatPeriodLabel(r.period, bucket) },
      { key: "records", label: BASIS_LABELS[params.basis], align: "right", render: (r) => String(r.records) },
      { key: "revenue", label: "Revenue", align: "right", render: (r) => formatMoney(r.revenue) },
      { key: "cost", label: "Cost", align: "right", render: (r) => formatMoney(r.cost) },
      { key: "margin", label: "Margin", align: "right", render: (r) => formatMoney(r.margin) },
      { key: "marginPct", label: "Margin %", align: "right", render: (r) => (r.revenue > 0 ? formatPercent((r.margin / r.revenue) * 100) : "—") },
    ],
    [bucket, params.basis],
  );

  const exportTable = useMemo(() => (q.data ? trendReportTable(q.data, params, bucket) : null), [q.data, params, bucket]);
  const chartData = useMemo(
    () =>
      (q.data?.rows ?? []).map((r) => ({ label: formatPeriodLabel(r.period, bucket), revenue: r.revenue, margin: r.margin })),
    [q.data, bucket],
  );

  return (
    <ReportPageShell
      title="Sales Trend"
      description="Revenue and margin over time. Select a period to see its records."
      backTo="/reports/sales"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} showBasis showBucket />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiStrip totals={q.data.totals} recordsLabel={BASIS_LABELS[params.basis]} />
          <ReportTrendChart data={chartData} label={`Revenue and margin by ${bucket}`} />
          <ReportDataTable
            caption="Sales trend"
            columns={columns}
            rows={q.data.rows}
            getRowKey={(r) => r.period}
            onRowClick={(r) => setDrill({ title: formatPeriodLabel(r.period, bucket), selector: { period: r.period } })}
          />
        </>
      )}
      {drill && (
        <ReportDrillPanel title={drill.title} params={params} selector={drill.selector} onClose={() => setDrill(null)} />
      )}
    </ReportPageShell>
  );
}

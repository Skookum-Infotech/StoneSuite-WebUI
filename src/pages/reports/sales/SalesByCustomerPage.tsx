import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatMoney } from "@/lib/formatMoney";
import { formatPercent, formatReportDate } from "@/lib/reportFormat";
import { BASIS_LABELS, customerReportTable } from "@/lib/salesReportTables";
import { reportsService } from "@/services/reportsService";
import type { SalesCustomerRow, SalesDrillSelector } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportDrillPanel } from "../components/ReportDrillPanel";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiStrip } from "../components/ReportKpiStrip";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";

const QUERY_KEY = "report-sales-by-customer";

interface DrillTarget {
  title: string;
  selector: SalesDrillSelector;
}

export default function SalesByCustomerPage() {
  const { state, actions, params } = useReportFilters();
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.salesByCustomer(params),
    placeholderData: (prev) => prev,
  });

  const columns = useMemo<ReportColumn<SalesCustomerRow>[]>(
    () => [
      { key: "name", label: "Customer", render: (r) => r.name },
      { key: "records", label: BASIS_LABELS[params.basis], align: "right", render: (r) => String(r.records) },
      { key: "revenue", label: "Revenue", align: "right", render: (r) => formatMoney(r.revenue) },
      { key: "cost", label: "Cost", align: "right", render: (r) => formatMoney(r.cost) },
      { key: "margin", label: "Margin", align: "right", render: (r) => formatMoney(r.margin) },
      { key: "marginPct", label: "Margin %", align: "right", render: (r) => (r.revenue > 0 ? formatPercent((r.margin / r.revenue) * 100) : "—") },
      { key: "avg", label: "Avg value", align: "right", render: (r) => formatMoney(r.avgValue) },
      { key: "last", label: "Last date", align: "right", render: (r) => formatReportDate(r.lastDate) },
    ],
    [params.basis],
  );

  const exportTable = useMemo(() => (q.data ? customerReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.rows ?? []).map((r) => ({ label: r.name, revenue: r.revenue, margin: r.margin })),
    [q.data],
  );

  return (
    <ReportPageShell
      title="Sales by Customer"
      description="Who you sell to, how much, and how profitable it is. Select a customer to see their records."
      backTo="/reports/sales"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} showBasis />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiStrip totals={q.data.totals} recordsLabel={BASIS_LABELS[params.basis]} />
          <ReportTopBarChart data={chartData} label="Top customers by revenue" />
          <ReportDataTable
            copy={{ caption: "Sales by customer" }}
            columns={columns}
            rows={q.data.rows}
            getRowKey={(r) => r.customerId}
            onRowClick={(r) => setDrill({ title: r.name, selector: { customerId: r.customerId } })}
          />
        </>
      )}
      {drill && (
        <ReportDrillPanel title={drill.title} params={params} selector={drill.selector} onClose={() => setDrill(null)} />
      )}
    </ReportPageShell>
  );
}

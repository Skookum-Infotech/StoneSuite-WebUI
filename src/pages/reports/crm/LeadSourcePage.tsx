import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { sourceReportTable } from "@/lib/crmReportTables";
import { formatMoney } from "@/lib/formatMoney";
import { formatPercent } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { CrmReportParams, CrmSourceRow } from "@/types/reports";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-crm-lead-sources";
const REVENUE_NOTE =
  "Revenue is the billed net sales (all time, excluding tax and shipping) of the customers these leads became, so it can keep growing after the period ends.";

const COLUMNS: ReportColumn<CrmSourceRow>[] = [
  { key: "source", label: "Source", render: (r) => r.source },
  { key: "leads", label: "Leads", align: "right", render: (r) => String(r.leads) },
  { key: "qualified", label: "Qualified", align: "right", render: (r) => String(r.qualified) },
  { key: "prospects", label: "Prospects", align: "right", render: (r) => String(r.prospects) },
  { key: "customers", label: "Customers", align: "right", render: (r) => String(r.customers) },
  { key: "conversion", label: "Conversion %", align: "right", render: (r) => formatPercent(r.conversionPercent) },
  { key: "revenue", label: "Revenue", align: "right", render: (r) => formatMoney(r.revenue) },
  { key: "perLead", label: "Revenue per lead", align: "right", render: (r) => formatMoney(r.revenuePerLead) },
];

export default function LeadSourcePage() {
  const { state, actions } = useReportFilters();
  const params = useMemo<CrmReportParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.crmLeadSources(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? sourceReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.rows ?? []).map((r) => ({ label: r.source, primary: r.leads, secondary: r.customers })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Leads", value: String(t.leads) },
      { label: "Became customers", value: String(t.customers) },
      { label: "Conversion", value: formatPercent(t.conversionPercent) },
      { label: "Revenue", value: formatMoney(t.revenue) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Lead Source Performance"
      description="Which sources bring leads that qualify, convert and pay."
      backTo="/reports/crm"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart data={chartData} label="Leads and customers by source" primaryName="Leads" secondaryName="Customers" />
          <ReportDataTable copy={{ caption: "Lead source performance" }} columns={COLUMNS} rows={q.data.rows} getRowKey={(r) => r.source} />
          <p className="text-label text-stone-500">{REVENUE_NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

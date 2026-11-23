import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { describeCrmWindow, formatDays, funnelReportTable } from "@/lib/crmReportTables";
import { formatPercent } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { CrmFunnelStage, CrmReportParams } from "@/types/reports";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-crm-funnel";
const CUSTOMER_STAGE = "customers";

const COLUMNS: ReportColumn<CrmFunnelStage>[] = [
  { key: "label", label: "Stage", render: (s) => s.label },
  { key: "count", label: "Leads", align: "right", render: (s) => String(s.count) },
  { key: "ofLeads", label: "% of all leads", align: "right", render: (s) => formatPercent(s.percentOfLeads) },
  { key: "ofPrev", label: "% of previous stage", align: "right", render: (s) => formatPercent(s.percentOfPrevious) },
  { key: "days", label: "Avg days from lead", align: "right", render: (s) => formatDays(s.avgDaysFromLead) },
];

export default function ConversionFunnelPage() {
  const { state, actions } = useReportFilters();
  const params = useMemo<CrmReportParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.crmFunnel(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? funnelReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.stages ?? []).map((s) => ({ label: s.label, primary: s.count })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const customers = q.data.stages.find((s) => s.key === CUSTOMER_STAGE);
    return [
      { label: "Leads created", value: String(q.data.stages[0]?.count ?? 0) },
      { label: "Became customers", value: String(customers?.count ?? 0) },
      { label: "Lead to customer", value: formatPercent(customers?.percentOfLeads ?? 0) },
      { label: "Avg days to customer", value: formatDays(customers?.avgDaysFromLead ?? null) },
      { label: "Unqualified", value: String(q.data.unqualified) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Conversion Funnel"
      description="Of the leads created in the period, how many qualified and became prospects and customers."
      backTo="/reports/crm"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart data={chartData} label="Leads by stage" primaryName="Leads" />
          <ReportDataTable copy={{ caption: "Conversion funnel" }} columns={COLUMNS} rows={q.data.stages} getRowKey={(s) => s.key} />
          <p className="text-label text-stone-500">
            {describeCrmWindow(params)}. A lead counts as qualified if it is Qualified now or has already been converted.
            Each step is measured on the same leads, so later stages can still grow as those leads progress.
          </p>
        </>
      )}
    </ReportPageShell>
  );
}

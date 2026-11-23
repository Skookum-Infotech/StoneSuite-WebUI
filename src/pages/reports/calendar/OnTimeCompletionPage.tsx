import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatAvgLate, onTimeReportTable } from "@/lib/calendarReportTables";
import { formatPercent } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { CalendarWindowParams, OnTimeRow } from "@/types/reports";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-calendar-on-time";
const EMPTY_TEXT = "No activities were completed in this period.";
const NOTE =
  "Counts activities marked completed in the period. On time means completed on or before the scheduled day. The Created activity is left out because it completes when the order is made. A planner moving a scheduled date after the fact changes the result.";

const COLUMNS: ReportColumn<OnTimeRow>[] = [
  { key: "activity", label: "Activity", render: (r) => r.activity },
  { key: "completed", label: "Completed", align: "right", render: (r) => String(r.completed) },
  { key: "onTime", label: "On time", align: "right", render: (r) => String(r.onTime) },
  { key: "late", label: "Late", align: "right", render: (r) => String(r.late) },
  { key: "pct", label: "On-time %", align: "right", render: (r) => formatPercent(r.onTimePercent) },
  { key: "avgLate", label: "Avg days late", align: "right", render: (r) => formatAvgLate(r.avgDaysLate) },
];

export default function OnTimeCompletionPage() {
  const { state, actions } = useReportFilters();
  const params = useMemo<CalendarWindowParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.onTimeCompletion(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? onTimeReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.rows ?? []).map((r) => ({ label: r.activity, primary: r.onTime, secondary: r.late })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Completed", value: String(t.completed) },
      { label: "On time", value: String(t.onTime) },
      { label: "Late", value: String(t.late) },
      { label: "On-time rate", value: formatPercent(t.onTimePercent) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="On-time Completion"
      description="How often each stage of an order finishes on the day it was scheduled."
      backTo="/reports/calendar"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart data={chartData} label="Completed on time and late, by activity" primaryName="On time" secondaryName="Late" />
          <ReportDataTable copy={{ caption: "On-time completion", empty: EMPTY_TEXT }} columns={COLUMNS} rows={q.data.rows} getRowKey={(r) => r.code} />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

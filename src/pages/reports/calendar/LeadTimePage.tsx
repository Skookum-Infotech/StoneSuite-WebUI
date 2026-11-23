import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatDayCount, leadTimeReportTable } from "@/lib/calendarReportTables";
import { formatPeriodLabel } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { CalendarWindowParams, LeadTimeRow } from "@/types/reports";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-calendar-lead-time";
const EMPTY_TEXT = "No installs were completed in this period.";
const NOTE =
  "Counts orders whose install was completed in the period, by the month of completion. Lead time is the days from the order date to the day the install was completed: the first completed install visit, or the completed Installation activity when no visit was booked. Cancelled orders are left out.";
const DAYS_ROUND = 10;

const COLUMNS: ReportColumn<LeadTimeRow>[] = [
  { key: "period", label: "Month", render: (r) => formatPeriodLabel(r.period, "month") },
  { key: "orders", label: "Orders installed", align: "right", render: (r) => String(r.orders) },
  { key: "avg", label: "Avg days", align: "right", render: (r) => formatDayCount(r.avgDays) },
  { key: "median", label: "Median days", align: "right", render: (r) => formatDayCount(r.medianDays) },
  { key: "min", label: "Fastest", align: "right", render: (r) => String(r.minDays) },
  { key: "max", label: "Slowest", align: "right", render: (r) => String(r.maxDays) },
];

export default function LeadTimePage() {
  const { state, actions } = useReportFilters();
  const params = useMemo<CalendarWindowParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.orderToInstallLeadTime(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? leadTimeReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () =>
      (q.data?.rows ?? []).map((r) => ({
        label: formatPeriodLabel(r.period, "month"),
        primary: Math.round(r.avgDays * DAYS_ROUND) / DAYS_ROUND,
      })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Orders installed", value: String(t.orders) },
      { label: "Average days", value: formatDayCount(t.avgDays) },
      { label: "Fastest (days)", value: String(t.minDays) },
      { label: "Slowest (days)", value: String(t.maxDays) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Order-to-Install Lead Time"
      description="How long it takes from taking an order to installing it."
      backTo="/reports/calendar"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart data={chartData} label="Average days from order to install, by month" primaryName="Avg days" />
          <ReportDataTable copy={{ caption: "Order-to-install lead time", empty: EMPTY_TEXT }} columns={COLUMNS} rows={q.data.rows} getRowKey={(r) => r.period} />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

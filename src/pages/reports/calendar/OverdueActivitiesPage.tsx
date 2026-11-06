import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatOverdueDays, overdueReportTable } from "@/lib/calendarReportTables";
import { formatReportDate } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { OverdueActivity } from "@/types/reports";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-calendar-overdue";
const EMPTY_TEXT = "Nothing is overdue: every pending activity is still on schedule.";
const NOTE =
  "Lists pending order activities whose scheduled time has passed, as of now. An activity someone has started is not counted as late, and neither are completed ones or cancelled orders. Dates are the order schedule's own, so moving an activity in the planner moves it here.";

const COLUMNS: ReportColumn<OverdueActivity>[] = [
  { key: "order", label: "Order", render: (r) => r.order || "(no number)", actionLabel: (order) => `Open ${order}` },
  { key: "customer", label: "Customer", render: (r) => r.customer },
  { key: "status", label: "Order status", render: (r) => r.orderStatus },
  { key: "activity", label: "Activity", render: (r) => r.activity },
  { key: "scheduled", label: "Scheduled", align: "right", render: (r) => formatReportDate(r.scheduledAt) },
  { key: "overdue", label: "Overdue by", align: "right", render: (r) => formatOverdueDays(r.daysOverdue) },
];

export default function OverdueActivitiesPage() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => reportsService.overdueActivities(),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? overdueReportTable(q.data) : null), [q.data]);
  const chartData = useMemo(
    () => (q.data?.totals.byActivity ?? []).map((a) => ({ label: a.activity, primary: a.count })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Overdue activities", value: String(t.activities) },
      { label: "Orders affected", value: String(t.orders) },
      { label: "Longest overdue", value: formatOverdueDays(t.oldestDays) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Overdue Activities"
      description="Scheduled work that should have started and has not. Select one to open its order."
      backTo="/reports/calendar"
      exportTable={exportTable}
    >
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart data={chartData} label="Overdue activities by type" primaryName="Overdue" />
          <ReportDataTable
            copy={{ caption: "Overdue activities", empty: EMPTY_TEXT }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => `${r.orderId}:${r.code}`}
            onRowClick={(r) => navigate(`/sales/sales_order/${r.orderId}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

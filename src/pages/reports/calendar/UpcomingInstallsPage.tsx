import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_UPCOMING_WEEKS,
  INSTALL_SOURCE_LABELS,
  UPCOMING_WEEK_OPTIONS,
  formatInstallDay,
  formatWeekLabel,
  upcomingReportTable,
} from "@/lib/calendarReportTables";
import { reportsService } from "@/services/reportsService";
import type { UpcomingInstall } from "@/types/reports";
import { ReportChipGroup } from "../components/ReportChipGroup";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-calendar-upcoming";
const NO_VALUE = "—";
const EMPTY_TEXT = "No installs are scheduled in this period.";
const NOTE =
  "A booked install visit is shown as booked. An order with no visit booked yet shows its planned Installation date from the order schedule. Orders already installed or cancelled are left out. Weeks start on Monday.";

const WEEK_OPTIONS = UPCOMING_WEEK_OPTIONS.map((w) => ({ value: w, label: `${w} weeks` }));

const COLUMNS: ReportColumn<UpcomingInstall>[] = [
  { key: "day", label: "Date", render: (r) => formatInstallDay(r.day), actionLabel: (day) => `Open order for ${day}` },
  { key: "order", label: "Order", render: (r) => r.order },
  { key: "customer", label: "Customer", render: (r) => r.customer },
  { key: "source", label: "Source", render: (r) => INSTALL_SOURCE_LABELS[r.source] },
  { key: "lead", label: "Crew lead", render: (r) => r.lead || NO_VALUE },
];

export default function UpcomingInstallsPage() {
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState(DEFAULT_UPCOMING_WEEKS);

  const q = useQuery({
    queryKey: [QUERY_KEY, weeks],
    queryFn: () => reportsService.upcomingInstalls(weeks),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? upcomingReportTable(q.data) : null), [q.data]);
  const chartData = useMemo(
    () => (q.data?.perWeek ?? []).map((w) => ({ label: formatWeekLabel(w.weekStart), primary: w.count })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    const rows = q.data?.rows ?? [];
    return [
      { label: "Installs", value: String(rows.length) },
      { label: "Booked visits", value: String(rows.filter((r) => r.source === "appointment").length) },
      { label: "Planned only", value: String(rows.filter((r) => r.source === "plan").length) },
      { label: "Next install", value: rows[0] ? formatInstallDay(rows[0].day) : NO_VALUE },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Upcoming Installs"
      description="Installs coming up, by week. Select one to open its order."
      backTo="/reports/calendar"
      exportTable={exportTable}
    >
      <ReportChipGroup label="Look ahead" value={weeks} options={WEEK_OPTIONS} onChange={setWeeks} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart data={chartData} label="Installs per week" primaryName="Installs" />
          <ReportDataTable
            copy={{ caption: "Upcoming installs", empty: EMPTY_TEXT }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => `${r.orderId}:${r.day}:${r.source}`}
            onRowClick={(r) => navigate(`/sales/sales_order/${r.orderId}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

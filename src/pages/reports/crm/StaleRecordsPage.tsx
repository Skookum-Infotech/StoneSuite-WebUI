import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { STAGE_LABELS, staleReportTable } from "@/lib/crmReportTables";
import { formatReportDate } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { CrmStaleRecord } from "@/types/reports";
import { ReportChipGroup } from "../components/ReportChipGroup";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-crm-stale";
const DEFAULT_IDLE_DAYS = 14;
const IDLE_DAY_OPTIONS = [7, 14, 30, 60, 90].map((d) => ({ value: d, label: `${d}+ days` }));
const NO_VALUE = "—";
const EMPTY_TEXT = "Nothing is stale: every open lead and prospect has been touched recently.";
const NOTE =
  "Open means not yet converted, and not an Unqualified lead or a Lost prospect. Last activity is the latest logged call, email, meeting, note or task, or status change; editing a record's fields does not count.";

const COLUMNS: ReportColumn<CrmStaleRecord>[] = [
  { key: "name", label: "Name", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
  { key: "stage", label: "Stage", render: (r) => STAGE_LABELS[r.stage] },
  { key: "status", label: "Status", render: (r) => r.status || NO_VALUE },
  { key: "owner", label: "Owner", render: (r) => r.owner || NO_VALUE },
  { key: "last", label: "Last activity", align: "right", render: (r) => formatReportDate(r.lastTouch) },
  { key: "idle", label: "Days idle", align: "right", render: (r) => String(r.daysIdle) },
];

export default function StaleRecordsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(DEFAULT_IDLE_DAYS);

  const q = useQuery({
    queryKey: [QUERY_KEY, days],
    queryFn: () => reportsService.crmStale(days),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? staleReportTable(q.data) : null), [q.data]);
  const kpis = useMemo<Kpi[]>(() => {
    const rows = q.data?.rows ?? [];
    return [
      { label: "Stale records", value: String(rows.length) },
      { label: "Leads", value: String(rows.filter((r) => r.stage === "lead").length) },
      { label: "Prospects", value: String(rows.filter((r) => r.stage === "prospect").length) },
      { label: "Longest idle (days)", value: String(rows[0]?.daysIdle ?? 0) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Stale Leads & Prospects"
      description="Open leads and prospects nobody has touched lately. Select one to open it."
      backTo="/reports/crm"
      exportTable={exportTable}
    >
      <ReportChipGroup label="Idle for" value={days} options={IDLE_DAY_OPTIONS} onChange={setDays} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportDataTable
            copy={{ caption: "Stale leads and prospects", empty: EMPTY_TEXT }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/crm/${r.stage}/${r.id}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

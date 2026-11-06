import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/formatMoney";
import { apAgingReportTable } from "@/lib/purchasesReportTables";
import { reportsService } from "@/services/reportsService";
import type { ApAgingRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";

const QUERY_KEY = "report-purchases-ap-aging";
const EMPTY_TEXT = "No unpaid vendor bills.";
const NOTE =
  "Counts approved, partially paid and overdue vendor bills with a balance still due, as of today. Days past due run from the bill's due date, or the bill date when it has none. Current means not yet due.";

export default function ApAgingPage() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => reportsService.apAging(),
    placeholderData: (prev) => prev,
  });

  const labels = q.data?.labels;
  const columns = useMemo<ReportColumn<ApAgingRow>[]>(
    () => [
      { key: "name", label: "Vendor", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
      { key: "bills", label: "Bills", align: "right", render: (r) => String(r.bills) },
      ...(labels ?? []).map((label, i) => ({
        key: `bucket-${i}`,
        label,
        align: "right" as const,
        render: (r: ApAgingRow) => formatMoney(r.buckets[i] ?? 0),
      })),
      { key: "total", label: "Total owed", align: "right", render: (r) => formatMoney(r.total) },
    ],
    [labels],
  );

  const exportTable = useMemo(() => (q.data ? apAgingReportTable(q.data) : null), [q.data]);
  const bucketChart = useMemo(
    () => (q.data ? q.data.labels.map((label, i) => ({ label, revenue: q.data.totals.buckets[i] ?? 0, margin: 0 })) : []),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    return [
      { label: "Total owed", value: formatMoney(q.data.totals.total) },
      { label: "Unpaid bills", value: String(q.data.totals.bills) },
      ...q.data.labels.map((label, i) => ({ label, value: formatMoney(q.data.totals.buckets[i] ?? 0) })),
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="AP Aging"
      description="What you owe each vendor, and how overdue it is. Select a vendor to open it."
      backTo="/reports/purchases"
      exportTable={exportTable}
    >
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          {q.data.rows.length > 0 && (
            <ReportTopBarChart data={bucketChart} label="Owed by age" names={{ primary: "Balance owed" }} />
          )}
          <ReportDataTable
            copy={{ caption: "AP aging", empty: EMPTY_TEXT }}
            columns={columns}
            rows={q.data.rows}
            getRowKey={(r) => r.vendorId}
            onRowClick={(r) => navigate(`/purchases/vendor/${r.vendorId}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

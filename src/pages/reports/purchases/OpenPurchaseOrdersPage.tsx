import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/formatMoney";
import { formatExpected, formatTiming, openPoReportTable } from "@/lib/purchasesReportTables";
import { formatPercent, formatReportDate } from "@/lib/reportFormat";
import { reportsService } from "@/services/reportsService";
import type { OpenPoRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-purchases-open-pos";
const EMPTY_TEXT = "No purchase orders are waiting on goods.";
const NOTE =
  "Shows purchase orders that are Sent to Vendor or Partially Received, as of today. Received is the average share received across the order's lines. Outstanding is the net value still to arrive. Late means the expected date has passed.";

const COLUMNS: ReportColumn<OpenPoRow>[] = [
  { key: "number", label: "PO", render: (r) => r.number || "(no number)", actionLabel: (n) => `Open ${n}` },
  { key: "vendor", label: "Vendor", render: (r) => r.vendor },
  { key: "status", label: "Status", render: (r) => r.status },
  { key: "ordered", label: "Order date", align: "right", render: (r) => formatReportDate(r.orderDate) },
  { key: "expected", label: "Expected", align: "right", render: (r) => formatExpected(r.expectedDate) },
  { key: "value", label: "Value", align: "right", render: (r) => formatMoney(r.value) },
  { key: "received", label: "Received", align: "right", render: (r) => formatPercent(r.receivedPercent) },
  { key: "outstanding", label: "Outstanding", align: "right", render: (r) => formatMoney(r.outstanding) },
  { key: "timing", label: "Timing", align: "right", render: (r) => formatTiming(r.expectedDate, r.daysOverdue) },
];

export default function OpenPurchaseOrdersPage() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => reportsService.openPurchaseOrders(),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? openPoReportTable(q.data) : null), [q.data]);
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Open orders", value: String(t.count) },
      { label: "Outstanding value", value: formatMoney(t.outstanding) },
      { label: "Late orders", value: String(t.overdueCount) },
      { label: "Late value", value: formatMoney(t.overdueValue) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Open POs & Receiving"
      description="Purchase orders still waiting on goods, most overdue first. Select one to open it."
      backTo="/reports/purchases"
      exportTable={exportTable}
    >
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportDataTable
            copy={{ caption: "Open purchase orders", empty: EMPTY_TEXT }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/purchases/purchase_order/${r.id}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

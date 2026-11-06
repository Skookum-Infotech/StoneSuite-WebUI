import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatMoney } from "@/lib/formatMoney";
import { vendorReportTable } from "@/lib/purchasesReportTables";
import { reportsService } from "@/services/reportsService";
import type { PurchaseVendorRow, PurchasesReportParams } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";

const QUERY_KEY = "report-purchases-by-vendor";
const NOTE =
  "Purchase orders count once sent to the vendor. Bills count once approved. Both are dated within the period. Open PO value is the part of those orders not yet received; balance owed is what is still unpaid on those bills. Amounts are net of tax and shipping.";

const COLUMNS: ReportColumn<PurchaseVendorRow>[] = [
  { key: "name", label: "Vendor", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
  { key: "pos", label: "POs", align: "right", render: (r) => String(r.poCount) },
  { key: "poValue", label: "PO value", align: "right", render: (r) => formatMoney(r.poValue) },
  { key: "avg", label: "Avg PO value", align: "right", render: (r) => formatMoney(r.avgPoValue) },
  { key: "open", label: "Open PO value", align: "right", render: (r) => formatMoney(r.openPoValue) },
  { key: "bills", label: "Bills", align: "right", render: (r) => String(r.billCount) },
  { key: "billed", label: "Billed", align: "right", render: (r) => formatMoney(r.billed) },
  { key: "owed", label: "Balance owed", align: "right", render: (r) => formatMoney(r.balanceOwed) },
];

export default function PurchasesByVendorPage() {
  const navigate = useNavigate();
  const { state, actions } = useReportFilters();
  const params = useMemo<PurchasesReportParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.purchasesByVendor(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? vendorReportTable(q.data, params) : null), [q.data, params]);
  const chartData = useMemo(
    () => (q.data?.rows ?? []).map((r) => ({ label: r.name, revenue: r.poValue, margin: r.billed })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "PO value", value: formatMoney(t.poValue) },
      { label: "Open PO value", value: formatMoney(t.openPoValue) },
      { label: "Billed", value: formatMoney(t.billed) },
      { label: "Balance owed", value: formatMoney(t.balanceOwed) },
      { label: "Purchase orders", value: String(t.poCount) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Purchases by Vendor"
      description="What you ordered and were billed by each vendor, and what is still outstanding. Select a vendor to open it."
      backTo="/reports/purchases"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportTopBarChart data={chartData} label="Top vendors" names={{ primary: "PO value", secondary: "Billed" }} />
          <ReportDataTable
            copy={{ caption: "Purchases by vendor" }}
            columns={COLUMNS}
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

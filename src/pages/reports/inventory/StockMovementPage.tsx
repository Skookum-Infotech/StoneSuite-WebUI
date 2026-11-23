import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useReportFilters } from "@/hooks/useReportFilters";
import { formatSignedQty, movementReportTable } from "@/lib/inventoryReportTables";
import { reportsService } from "@/services/reportsService";
import type { InventoryMovementParams, MovementRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportFilters } from "../components/ReportFilters";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-inventory-movement";
const NOTE =
  "Every stock movement dated in the period, per item. Receipts and returns add; consumption and scrap subtract. Adjusted covers inventory counts, adjustments and transfers. Quantities are in each item's own unit, so they are not added across items.";

const COLUMNS: ReportColumn<MovementRow>[] = [
  { key: "name", label: "Item", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
  { key: "sku", label: "SKU", render: (r) => r.sku },
  { key: "received", label: "Received", align: "right", render: (r) => formatSignedQty(r.received, r.unit) },
  { key: "returned", label: "Returned", align: "right", render: (r) => formatSignedQty(r.returned, r.unit) },
  { key: "consumed", label: "Consumed", align: "right", render: (r) => formatSignedQty(r.consumed, r.unit) },
  { key: "scrapped", label: "Scrapped", align: "right", render: (r) => formatSignedQty(r.scrapped, r.unit) },
  { key: "adjusted", label: "Adjusted", align: "right", render: (r) => formatSignedQty(r.adjusted, r.unit) },
  { key: "net", label: "Net change", align: "right", render: (r) => formatSignedQty(r.net, r.unit) },
  { key: "movements", label: "Movements", align: "right", render: (r) => String(r.movements) },
];

export default function StockMovementPage() {
  const navigate = useNavigate();
  const { state, actions } = useReportFilters();
  const params = useMemo<InventoryMovementParams>(() => ({ from: state.range.from, to: state.range.to }), [state.range.from, state.range.to]);

  const q = useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => reportsService.stockMovement(params),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? movementReportTable(q.data, params) : null), [q.data, params]);
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Items with movement", value: String(t.items) },
      { label: "Movements", value: String(t.movements) },
      { label: "Stock grew", value: String(t.growing) },
      { label: "Stock shrank", value: String(t.shrinking) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Stock Movement"
      description="What came in, went out and was adjusted for each item. Select an item to open it."
      backTo="/reports/inventory"
      exportTable={exportTable}
    >
      <ReportFilters state={state} actions={actions} />
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportDataTable
            copy={{ caption: "Stock movement" }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => r.itemId}
            onRowClick={(r) => navigate(`/inventory/item/${r.itemId}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

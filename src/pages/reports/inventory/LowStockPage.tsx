import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LOW_STOCK_STATE_LABELS, formatQty, lowStockReportTable } from "@/lib/inventoryReportTables";
import { reportsService } from "@/services/reportsService";
import type { LowStockRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-inventory-low-stock";
const EMPTY_TEXT = "Nothing is at or below its reorder point. Only items with a reorder point set are checked.";
const NOTE =
  "Lists items at or below the reorder point set for their location, most depleted first. On order is the open purchase-order quantity not yet received, across all locations. Suggested order brings stock back up to the reorder point after counting what is on order.";

const COLUMNS: ReportColumn<LowStockRow>[] = [
  { key: "name", label: "Item", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
  { key: "sku", label: "SKU", render: (r) => r.sku },
  { key: "location", label: "Location", render: (r) => r.location },
  { key: "state", label: "Status", render: (r) => LOW_STOCK_STATE_LABELS[r.state] },
  { key: "onHand", label: "On hand", align: "right", render: (r) => formatQty(r.onHand, r.unit) },
  { key: "available", label: "Available", align: "right", render: (r) => formatQty(r.available, r.unit) },
  { key: "reorder", label: "Reorder point", align: "right", render: (r) => formatQty(r.reorderPoint, r.unit) },
  { key: "onOrder", label: "On order", align: "right", render: (r) => formatQty(r.onOrder, r.unit) },
  { key: "suggested", label: "Suggested order", align: "right", render: (r) => formatQty(r.suggestedOrder, r.unit) },
];

export default function LowStockPage() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => reportsService.lowStock(),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? lowStockReportTable(q.data) : null), [q.data]);
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "At or below reorder point", value: String(t.rows) },
      { label: "Out of stock", value: String(t.outOfStock) },
      { label: "Items affected", value: String(t.items) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Low Stock"
      description="Items that have fallen to their reorder point, and what to order. Select an item to open it."
      backTo="/reports/inventory"
      exportTable={exportTable}
    >
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportDataTable
            copy={{ caption: "Low stock", empty: EMPTY_TEXT }}
            columns={COLUMNS}
            rows={q.data.rows}
            getRowKey={(r) => `${r.itemId}:${r.location}`}
            onRowClick={(r) => navigate(`/inventory/item/${r.itemId}`)}
          />
          <p className="text-label text-stone-500">{NOTE}</p>
        </>
      )}
    </ReportPageShell>
  );
}

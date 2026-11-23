import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/formatMoney";
import { formatQty, stockReportTable, valueByItem } from "@/lib/inventoryReportTables";
import { reportsService } from "@/services/reportsService";
import type { StockRow } from "@/types/reports";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";
import { ReportTopBarChart } from "../components/ReportTopBarChart";

const QUERY_KEY = "report-inventory-stock";
const EMPTY_TEXT = "No stock on hand.";
const NOTE =
  "Quantity on hand per item and location as of today. Allocated is what open sales orders have reserved; available is on hand less allocated. Value is on hand times the item's current purchasing price, so it moves if that price is edited.";

const COLUMNS: ReportColumn<StockRow>[] = [
  { key: "name", label: "Item", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
  { key: "sku", label: "SKU", render: (r) => r.sku },
  { key: "location", label: "Location", render: (r) => r.location },
  { key: "onHand", label: "On hand", align: "right", render: (r) => formatQty(r.onHand, r.unit) },
  { key: "allocated", label: "Allocated", align: "right", render: (r) => formatQty(r.allocated, r.unit) },
  { key: "available", label: "Available", align: "right", render: (r) => formatQty(r.available, r.unit) },
  { key: "unitCost", label: "Unit cost", align: "right", render: (r) => formatMoney(r.unitCost) },
  { key: "value", label: "Value", align: "right", render: (r) => formatMoney(r.value) },
];

export default function StockOnHandPage() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => reportsService.stockOnHand(),
    placeholderData: (prev) => prev,
  });

  const exportTable = useMemo(() => (q.data ? stockReportTable(q.data) : null), [q.data]);
  const chartData = useMemo(
    () => valueByItem(q.data?.rows ?? []).map((i) => ({ label: i.name, revenue: i.value, margin: 0 })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    const t = q.data.totals;
    return [
      { label: "Stock value", value: formatMoney(t.value) },
      { label: "Items in stock", value: String(t.items) },
      { label: "Locations", value: String(t.locations) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Stock on Hand & Valuation"
      description="What is in stock at each location and what it is worth. Select an item to open it."
      backTo="/reports/inventory"
      exportTable={exportTable}
    >
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportTopBarChart data={chartData} label="Stock value by item" names={{ primary: "Value" }} />
          <ReportDataTable
            copy={{ caption: "Stock on hand", empty: EMPTY_TEXT }}
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

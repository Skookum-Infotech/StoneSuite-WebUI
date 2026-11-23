import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatSlabCell, slabReportTable } from "@/lib/inventoryReportTables";
import { reportsService } from "@/services/reportsService";
import type { SlabRow } from "@/types/reports";
import { ReportCountBarChart } from "../components/ReportCountBarChart";
import { ReportDataTable, type ReportColumn } from "../components/ReportDataTable";
import { ReportKpiGrid, type Kpi } from "../components/ReportKpiGrid";
import { ReportPageShell } from "../components/ReportPageShell";
import { ReportQueryState } from "../components/ReportQueryState";

const QUERY_KEY = "report-inventory-slabs";
const EMPTY_TEXT = "No live slabs.";
const AVAILABLE_INDEX = 0;
const RESERVED_INDEX = 1;
const NOTE =
  "Counts serialized slabs that are still in play: available (binned and free), reserved for a customer, received but not yet binned, on order, or in transit. Consumed and scrapped slabs are not counted. Area is in each material's own unit.";

export default function SlabAvailabilityPage() {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => reportsService.slabAvailability(),
    placeholderData: (prev) => prev,
  });

  const labels = q.data?.labels;
  const columns = useMemo<ReportColumn<SlabRow>[]>(
    () => [
      { key: "name", label: "Material", render: (r) => r.name, actionLabel: (name) => `Open ${name}` },
      { key: "sku", label: "SKU", render: (r) => r.sku },
      ...(labels ?? []).map((label, i) => ({
        key: `status-${i}`,
        label,
        align: "right" as const,
        render: (r: SlabRow) => formatSlabCell(r.counts[i] ?? 0, r.areas[i] ?? 0, r.unit),
      })),
      { key: "total", label: "Total", align: "right", render: (r) => formatSlabCell(r.totalSlabs, r.totalArea, r.unit) },
    ],
    [labels],
  );

  const exportTable = useMemo(() => (q.data ? slabReportTable(q.data) : null), [q.data]);
  const chartData = useMemo(
    () =>
      (q.data?.rows ?? []).map((r) => ({
        label: r.name,
        primary: r.counts[AVAILABLE_INDEX] ?? 0,
        secondary: r.counts[RESERVED_INDEX] ?? 0,
      })),
    [q.data],
  );
  const kpis = useMemo<Kpi[]>(() => {
    if (!q.data) return [];
    return [
      ...q.data.labels.map((label, i) => ({ label, value: String(q.data.totals.counts[i] ?? 0) })),
      { label: "All live slabs", value: String(q.data.totals.totalSlabs) },
    ];
  }, [q.data]);

  return (
    <ReportPageShell
      title="Slab Availability"
      description="How many slabs of each material are free, reserved, coming or waiting for a bin. Select a material to open it."
      backTo="/reports/inventory"
      exportTable={exportTable}
    >
      <ReportQueryState isLoading={q.isLoading} error={q.error} />
      {q.data && (
        <>
          <ReportKpiGrid items={kpis} />
          <ReportCountBarChart
            data={chartData}
            label="Available and reserved slabs by material"
            primaryName="Available"
            secondaryName="Reserved"
          />
          <ReportDataTable
            copy={{ caption: "Slab availability", empty: EMPTY_TEXT }}
            columns={columns}
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

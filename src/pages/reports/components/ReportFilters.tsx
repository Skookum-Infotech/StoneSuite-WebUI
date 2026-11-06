import { DatePicker } from "@/components/ui/date-picker";
import { REPORT_RANGE_PRESETS } from "@/lib/reportDateRange";
import { BASIS_LABELS } from "@/lib/salesReportTables";
import type { ReportFilterActions, ReportFilterState } from "@/hooks/useReportFilters";
import type { SalesBasis, TrendBucket } from "@/types/reports";
import { ReportChipGroup } from "./ReportChipGroup";

interface ReportFiltersProps {
  state: ReportFilterState;
  actions: ReportFilterActions;
  /** Show the Orders / Invoices toggle (Sales reports). */
  showBasis?: boolean;
  /** Show the Week / Month toggle (trend reports). */
  showBucket?: boolean;
}

const BASES: SalesBasis[] = ["invoices", "orders"];
const BUCKETS: { value: TrendBucket; label: string }[] = [
  { value: "month", label: "By month" },
  { value: "week", label: "By week" },
];

export function ReportFilters({ state, actions, showBasis, showBucket }: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="search" aria-label="Report filters">
      <ReportChipGroup label="Date range" value={state.preset} options={REPORT_RANGE_PRESETS} onChange={actions.setPreset} />

      <div className="flex items-center gap-2">
        <div className="w-40">
          <DatePicker
            label="From date"
            value={state.range.from}
            onChange={(from) => actions.setCustomRange({ from, to: state.range.to })}
          />
        </div>
        <span className="text-xs text-stone-500" aria-hidden="true">to</span>
        <div className="w-40">
          <DatePicker
            label="To date"
            value={state.range.to}
            minDate={state.range.from}
            onChange={(to) => actions.setCustomRange({ from: state.range.from, to })}
          />
        </div>
      </div>

      {showBasis && (
        <ReportChipGroup
          label="Based on"
          value={state.basis}
          options={BASES.map((b) => ({ value: b, label: BASIS_LABELS[b] }))}
          onChange={actions.setBasis}
        />
      )}
      {showBucket && <ReportChipGroup label="Group" value={state.bucket} options={BUCKETS} onChange={actions.setBucket} />}
    </div>
  );
}

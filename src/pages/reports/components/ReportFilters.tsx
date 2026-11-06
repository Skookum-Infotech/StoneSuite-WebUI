import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { REPORT_RANGE_PRESETS } from "@/lib/reportDateRange";
import { BASIS_LABELS } from "@/lib/salesReportTables";
import type { ReportFilterActions, ReportFilterState } from "@/hooks/useReportFilters";
import type { SalesBasis, TrendBucket } from "@/types/reports";

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

const CHIP_BASE =
  "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";
const CHIP_ON = "border-stone-900 bg-stone-900 text-white";
const CHIP_OFF = "border-stone-200 bg-white text-stone-600 hover:bg-stone-50";

interface ChipGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function ChipGroup<T extends string>({ label, value, options, onChange }: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={`${label}: ${o.label}`}
          onClick={() => onChange(o.value)}
          className={cn(CHIP_BASE, value === o.value ? CHIP_ON : CHIP_OFF)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ReportFilters({ state, actions, showBasis, showBucket }: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="search" aria-label="Report filters">
      <ChipGroup label="Date range" value={state.preset} options={REPORT_RANGE_PRESETS} onChange={actions.setPreset} />

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
        <ChipGroup
          label="Based on"
          value={state.basis}
          options={BASES.map((b) => ({ value: b, label: BASIS_LABELS[b] }))}
          onChange={actions.setBasis}
        />
      )}
      {showBucket && <ChipGroup label="Group" value={state.bucket} options={BUCKETS} onChange={actions.setBucket} />}
    </div>
  );
}

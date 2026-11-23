import { cn } from "@/lib/utils";
import type { BuilderAction } from "@/hooks/useCustomReportBuilder";
import type { CustomChart, CustomReportDefinition } from "@/types/customReports";
import { SECTION_TITLE } from "./builderStyles";

interface ChartPickerProps {
  definition: CustomReportDefinition;
  dispatch: (action: BuilderAction) => void;
}

const CHOICES: { value: CustomChart; label: string }[] = [
  { value: "bar", label: "Bar chart" },
  { value: "none", label: "No chart" },
];

const CHIP =
  "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";

/** A bar chart of the first total needs a grouped report; otherwise only the table. */
export function ChartPicker({ definition, dispatch }: ChartPickerProps) {
  const canChart = Boolean(definition.groupBy) && definition.totals.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Chart</h3>
      <div role="group" aria-label="Chart type" className="flex gap-1">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.label}
            aria-pressed={definition.chart === c.value}
            disabled={c.value === "bar" && !canChart}
            onClick={() => dispatch({ type: "setChart", chart: c.value })}
            className={cn(
              CHIP,
              definition.chart === c.value
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {!canChart && <p className="text-xs text-stone-500">Group the report to chart it.</p>}
    </div>
  );
}

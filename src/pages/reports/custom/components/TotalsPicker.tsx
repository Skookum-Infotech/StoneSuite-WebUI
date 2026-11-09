import { Plus, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import type { BuilderAction } from "@/hooks/useCustomReportBuilder";
import { CUSTOM_MAX_TOTALS, type CatalogField, type CustomAggFn, type CustomTotal } from "@/types/customReports";
import { FieldSelect } from "./FieldSelect";
import { ICON_BUTTON, SECTION_TITLE, SELECT_CLASS, SMALL_BUTTON } from "./builderStyles";

interface TotalsPickerProps {
  fields: CatalogField[];
  totals: CustomTotal[];
  dispatch: (action: BuilderAction) => void;
}

const FUNCTIONS: { value: CustomAggFn; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "count", label: "Count" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

const isNumeric = (f: CatalogField) => f.type === "number" || f.type === "money";

/** The totals shown for each group: Sum, Count, Average, Min or Max. A grouped
 *  report always keeps at least one. */
export function TotalsPicker({ fields, totals, dispatch }: TotalsPickerProps) {
  const numeric = fields.filter(isNumeric);
  const functions = numeric.length > 0 ? FUNCTIONS : FUNCTIONS.filter((f) => f.value === "count");

  function update(index: number, next: CustomTotal) {
    dispatch({ type: "setTotals", totals: totals.map((t, i) => (i === index ? next : t)) });
  }

  function changeFn(index: number, fn: CustomAggFn) {
    const current = totals[index];
    update(index, fn === "count" ? { fn } : { fn, field: current.field ?? numeric[0]?.key });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Totals</h3>
      {totals.map((total, index) => {
        const n = index + 1;
        return (
          <div key={index} className="flex items-center gap-1.5">
            <div className="w-28 shrink-0">
              <Select
                aria-label={`Total ${n} function`}
                value={total.fn}
                onChange={(e) => changeFn(index, e.target.value as CustomAggFn)}
                className={SELECT_CLASS}
              >
                {functions.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            {total.fn !== "count" ? (
              <div className="min-w-0 flex-1">
                <FieldSelect
                  fields={numeric}
                  value={total.field ?? ""}
                  onChange={(key) => update(index, { fn: total.fn, field: key })}
                  label={`Total ${n} field`}
                />
              </div>
            ) : (
              <span className="flex-1 text-xs text-stone-500">of rows</span>
            )}
            <button
              type="button"
              aria-label={`Remove total ${n}`}
              disabled={totals.length === 1}
              onClick={() => dispatch({ type: "setTotals", totals: totals.filter((_, i) => i !== index) })}
              className={ICON_BUTTON}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {totals.length < CUSTOM_MAX_TOTALS && (
        <button
          type="button"
          aria-label="Add total"
          onClick={() => dispatch({ type: "setTotals", totals: [...totals, { fn: "count" }] })}
          className={`${SMALL_BUTTON} self-start`}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add total
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { filterDefaults, operatorsFor } from "@/lib/customReportDefinition";
import { REPORT_RANGE_PRESETS, resolveReportRange, type ReportRangePreset } from "@/lib/reportDateRange";
import type { CatalogField, CustomFilterRule, CustomOperator } from "@/types/customReports";
import { ReportChipGroup } from "../../components/ReportChipGroup";
import { FieldSelect } from "./FieldSelect";
import { ICON_BUTTON, SELECT_CLASS } from "./builderStyles";

interface FilterRowProps {
  /** Accessible prefix, e.g. "Filter 1". */
  label: string;
  rule: CustomFilterRule;
  fields: CatalogField[];
  onChange: (rule: CustomFilterRule) => void;
  onRemove: () => void;
}

const OPERATOR_LABELS: Record<CustomOperator, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  in: "is one of",
  is_empty: "is empty",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  between: "is between",
  date_range: "is in",
};

const SINGLE_VALUE_OPS: CustomOperator[] = ["eq", "neq", "contains", "gt", "gte", "lt", "lte"];

// Joins values for comparing two lists; the ASCII unit separator, which no
// filter value contains.
const UNIT_SEPARATOR_CODE = 31;
const LIST_SEPARATOR = String.fromCharCode(UNIT_SEPARATOR_CODE);

const CHIP_ON =
  "inline-flex h-7 items-center rounded-full border border-stone-900 bg-stone-900 px-3 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";
const CHIP_OFF =
  "inline-flex h-7 items-center rounded-full border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

/** One filter: a field, a comparison, and the inputs that comparison needs. */
export function FilterRow({ label, rule, fields, onChange, onRemove }: FilterRowProps) {
  const field = fields.find((f) => f.key === rule.field) ?? fields[0];
  // "is one of" on plain text is edited as a comma-separated list; the text is
  // parsed into values when the input loses focus.
  const [listText, setListText] = useState(rule.values.join(", "));
  const [seenValues, setSeenValues] = useState(rule.values);
  // A different filter put in this row (another row removed above it, Undo, an
  // assistant change) must not show the previous row's text. The user's own
  // edits flow back in as the same list, so what they are typing is kept.
  if (seenValues !== rule.values) {
    setSeenValues(rule.values);
    if (splitList(listText).join(LIST_SEPARATOR) !== rule.values.join(LIST_SEPARATOR)) setListText(rule.values.join(", "));
  }
  const operators = operatorsFor(field.type).filter((op) => op !== "in" || field.type === "status" || rule.op === "in");

  function pickField(key: string) {
    const next = fields.find((f) => f.key === key);
    if (!next) return;
    const op = operatorsFor(next.type)[0];
    onChange({ field: next.key, op, ...filterDefaults(op) });
  }

  function pickOperator(value: string) {
    const op = value as CustomOperator;
    onChange({ field: rule.field, op, ...filterDefaults(op) });
    setListText("");
  }

  function setValue(index: number, value: string) {
    const values = [...rule.values];
    values[index] = value;
    onChange({ ...rule, values });
  }

  function pickPreset(preset: ReportRangePreset) {
    const { from, to } = resolveReportRange(preset, new Date());
    onChange({ ...rule, preset, values: preset === "custom" ? [from, to] : [] });
  }

  function toggleOption(option: string) {
    const has = rule.values.includes(option);
    onChange({ ...rule, values: has ? rule.values.filter((v) => v !== option) : [...rule.values, option] });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-stone-200 p-2">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <FieldSelect fields={fields} value={field.key} onChange={pickField} label={`${label} field`} />
        </div>
        <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={onRemove} className={ICON_BUTTON}>
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <Select aria-label={`${label} operator`} value={rule.op} onChange={(e) => pickOperator(e.target.value)} className={SELECT_CLASS}>
        {operators.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABELS[op]}
          </option>
        ))}
      </Select>
      {rule.op === "date_range" && (
        <div className="flex flex-col gap-1.5">
          <ReportChipGroup
            label={`${label} date range`}
            value={rule.preset ?? "custom"}
            options={REPORT_RANGE_PRESETS}
            onChange={pickPreset}
          />
          {(rule.preset ?? "custom") === "custom" && (
            <div className="flex items-center gap-2">
              <DatePicker label={`${label} from date`} value={rule.values[0] ?? ""} onChange={(v) => setValue(0, v)} />
              <span className="text-xs text-stone-500" aria-hidden="true">
                to
              </span>
              <DatePicker
                label={`${label} to date`}
                value={rule.values[1] ?? ""}
                minDate={rule.values[0]}
                onChange={(v) => setValue(1, v)}
              />
            </div>
          )}
        </div>
      )}
      {rule.op === "between" && (
        <div className="flex items-center gap-2">
          <Input aria-label={`${label} from`} inputMode="decimal" value={rule.values[0] ?? ""} onChange={(e) => setValue(0, e.target.value)} />
          <span className="text-xs text-stone-500" aria-hidden="true">
            and
          </span>
          <Input aria-label={`${label} to`} inputMode="decimal" value={rule.values[1] ?? ""} onChange={(e) => setValue(1, e.target.value)} />
        </div>
      )}
      {rule.op === "in" && field.type === "status" && (
        <div role="group" aria-label={`${label} statuses`} className="flex flex-wrap gap-1">
          {(field.options ?? []).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={rule.values.includes(option)}
              aria-label={`${label}: ${option}`}
              onClick={() => toggleOption(option)}
              className={rule.values.includes(option) ? CHIP_ON : CHIP_OFF}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {rule.op === "in" && field.type !== "status" && (
        <Input
          aria-label={`${label} values`}
          placeholder="Separate values with commas"
          value={listText}
          onChange={(e) => setListText(e.target.value)}
          onBlur={() => onChange({ ...rule, values: splitList(listText) })}
        />
      )}
      {SINGLE_VALUE_OPS.includes(rule.op) && (
        <Input
          aria-label={`${label} value`}
          inputMode={field.type === "number" || field.type === "money" ? "decimal" : undefined}
          value={rule.values[0] ?? ""}
          onChange={(e) => setValue(0, e.target.value)}
        />
      )}
    </div>
  );
}

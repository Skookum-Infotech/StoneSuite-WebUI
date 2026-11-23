import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { totalLabel } from "@/lib/customReportDefinition";
import type { BuilderAction } from "@/hooks/useCustomReportBuilder";
import { CUSTOM_MAX_TOP_N, type CatalogSource, type CustomReportDefinition } from "@/types/customReports";
import { SECTION_TITLE, SELECT_CLASS } from "./builderStyles";

interface SortPickerProps {
  definition: CustomReportDefinition;
  source: CatalogSource;
  dispatch: (action: BuilderAction) => void;
}

const DEFAULT_ORDER = "";

/** What the rows are ordered by, which way, and how many to keep ("top 10"). */
export function SortPicker({ definition, source, dispatch }: SortPickerProps) {
  const labelOf = (key: string) => source.fields.find((f) => f.key === key)?.label ?? key;
  const options = definition.groupBy
    ? [
        { value: "group", label: labelOf(definition.groupBy.field) },
        ...definition.totals.map((t, i) => ({ value: `total:${i}`, label: totalLabel(t, source) })),
      ]
    : definition.columns.map((key) => ({ value: key, label: labelOf(key) }));
  const sort = definition.sort;

  function setKey(key: string) {
    dispatch({ type: "setSort", sort: key === DEFAULT_ORDER ? null : { key, desc: sort?.desc ?? true } });
  }

  function setTopN(raw: string) {
    const n = Number.parseInt(raw, 10);
    dispatch({ type: "setSort", sort: sort ?? null, topN: Number.isNaN(n) ? 0 : n });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Sort</h3>
      <Select aria-label="Sort by" value={sort?.key ?? DEFAULT_ORDER} onChange={(e) => setKey(e.target.value)} className={SELECT_CLASS}>
        <option value={DEFAULT_ORDER}>Default order</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {sort && (
        <Select
          aria-label="Sort direction"
          value={sort.desc ? "desc" : "asc"}
          onChange={(e) => dispatch({ type: "setSort", sort: { key: sort.key, desc: e.target.value === "desc" } })}
          className={SELECT_CLASS}
        >
          <option value="desc">Largest first</option>
          <option value="asc">Smallest first</option>
        </Select>
      )}
      <Input
        aria-label="Top N"
        type="number"
        min={1}
        max={CUSTOM_MAX_TOP_N}
        placeholder="Show all rows"
        value={definition.topN ?? ""}
        onChange={(e) => setTopN(e.target.value)}
      />
    </div>
  );
}

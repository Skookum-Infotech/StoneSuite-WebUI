import { Plus } from "lucide-react";
import { newFilterRule } from "@/lib/customReportDefinition";
import type { BuilderAction } from "@/hooks/useCustomReportBuilder";
import { CUSTOM_MAX_FILTERS, type CatalogField, type CustomFilterRule } from "@/types/customReports";
import { FilterRow } from "./FilterRow";
import { SECTION_TITLE, SMALL_BUTTON } from "./builderStyles";

interface FilterListProps {
  filters: CustomFilterRule[];
  fields: CatalogField[];
  dispatch: (action: BuilderAction) => void;
}

/** The report's filters, each editable, with a button for adding another. */
export function FilterList({ filters, fields, dispatch }: FilterListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Filters</h3>
      {filters.map((rule, index) => (
        <FilterRow
          key={index}
          label={`Filter ${index + 1}`}
          rule={rule}
          fields={fields}
          onChange={(next) => dispatch({ type: "setFilter", index, rule: next })}
          onRemove={() => dispatch({ type: "removeFilter", index })}
        />
      ))}
      {filters.length < CUSTOM_MAX_FILTERS ? (
        <button
          type="button"
          aria-label="Add filter"
          onClick={() => dispatch({ type: "addFilter", rule: newFilterRule(fields[0]) })}
          className={`${SMALL_BUTTON} self-start`}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add filter
        </button>
      ) : (
        <p className="text-xs text-stone-500">A report can have at most {CUSTOM_MAX_FILTERS} filters.</p>
      )}
    </div>
  );
}

import type { BuilderAction } from "@/hooks/useCustomReportBuilder";
import type { CatalogSource, CustomReportDefinition } from "@/types/customReports";
import { ChartPicker } from "./ChartPicker";
import { ColumnPicker } from "./ColumnPicker";
import { FilterList } from "./FilterList";
import { GroupByPicker } from "./GroupByPicker";
import { SortPicker } from "./SortPicker";
import { SourcePicker } from "./SourcePicker";
import { TotalsPicker } from "./TotalsPicker";

interface BuilderSettingsProps {
  sources: CatalogSource[];
  source: CatalogSource;
  definition: CustomReportDefinition;
  dispatch: (action: BuilderAction) => void;
  /** Someone else's shared report: every control is disabled. */
  readOnly: boolean;
}

/** The left column of the builder: source, columns, filters, group by, totals,
 *  sort and chart. A disabled fieldset turns every control off at once. */
export function BuilderSettings({ sources, source, definition, dispatch, readOnly }: BuilderSettingsProps) {
  return (
    <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="sr-only">Report settings</legend>
      <SourcePicker sources={sources} value={source.key} onChange={(next) => dispatch({ type: "setSource", source: next })} />
      {!definition.groupBy && (
        <ColumnPicker fields={source.fields} columns={definition.columns} onToggle={(key) => dispatch({ type: "toggleColumn", key })} />
      )}
      <FilterList filters={definition.filters} fields={source.fields} dispatch={dispatch} />
      <GroupByPicker fields={source.fields} groupBy={definition.groupBy} dispatch={dispatch} />
      {definition.groupBy && <TotalsPicker fields={source.fields} totals={definition.totals} dispatch={dispatch} />}
      <SortPicker definition={definition} source={source} dispatch={dispatch} />
      <ChartPicker definition={definition} dispatch={dispatch} />
    </fieldset>
  );
}

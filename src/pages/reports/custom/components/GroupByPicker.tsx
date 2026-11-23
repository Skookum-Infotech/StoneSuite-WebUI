import { Select } from "@/components/ui/select";
import type { BuilderAction } from "@/hooks/useCustomReportBuilder";
import type { CatalogField, CustomDateBucket, CustomGroupBy } from "@/types/customReports";
import { FieldSelect } from "./FieldSelect";
import { SECTION_TITLE, SELECT_CLASS } from "./builderStyles";

interface GroupByPickerProps {
  fields: CatalogField[];
  groupBy: CustomGroupBy | undefined;
  dispatch: (action: BuilderAction) => void;
}

const BUCKETS: { value: CustomDateBucket; label: string }[] = [
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
  { value: "quarter", label: "By quarter" },
];

const DEFAULT_BUCKET: CustomDateBucket = "month";

/** Adds up rows by one field (a date can be grouped by day, week, month or
 *  quarter). Choosing no grouping turns the report back into a plain list. */
export function GroupByPicker({ fields, groupBy, dispatch }: GroupByPickerProps) {
  const field = fields.find((f) => f.key === groupBy?.field);

  function pick(key: string) {
    const next = fields.find((f) => f.key === key);
    if (!next) {
      dispatch({ type: "setGroupBy", groupBy: null });
      return;
    }
    dispatch({
      type: "setGroupBy",
      groupBy: next.type === "date" ? { field: key, dateBucket: groupBy?.dateBucket ?? DEFAULT_BUCKET } : { field: key },
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Group by</h3>
      <FieldSelect fields={fields} value={groupBy?.field ?? ""} onChange={pick} label="Group by field" emptyLabel="No grouping (list rows)" />
      {groupBy && field?.type === "date" && (
        <Select
          aria-label="Group by date bucket"
          value={groupBy.dateBucket ?? DEFAULT_BUCKET}
          onChange={(e) =>
            dispatch({ type: "setGroupBy", groupBy: { field: groupBy.field, dateBucket: e.target.value as CustomDateBucket } })
          }
          className={SELECT_CLASS}
        >
          {BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

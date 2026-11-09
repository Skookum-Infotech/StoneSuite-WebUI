import { X } from "lucide-react";
import { CUSTOM_MAX_COLUMNS, type CatalogField } from "@/types/customReports";
import { FieldSelect } from "./FieldSelect";
import { ICON_BUTTON, SECTION_TITLE } from "./builderStyles";

interface ColumnPickerProps {
  fields: CatalogField[];
  columns: string[];
  onToggle: (key: string) => void;
}

const ADD_LABEL = "Add column";

/** The columns of a list report: the chosen ones as removable chips, and a
 *  picker for adding more. */
export function ColumnPicker({ fields, columns, onToggle }: ColumnPickerProps) {
  const chosen = columns.map((key) => fields.find((f) => f.key === key)).filter((f): f is CatalogField => Boolean(f));
  const remaining = fields.filter((f) => !columns.includes(f.key));
  const full = columns.length >= CUSTOM_MAX_COLUMNS;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Columns</h3>
      <ul className="flex flex-wrap gap-1.5" aria-label="Chosen columns">
        {chosen.map((f) => (
          <li key={f.key} className="inline-flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-50 pl-3 text-xs text-stone-700">
            {f.label}
            <button type="button" aria-label={`Remove column ${f.label}`} onClick={() => onToggle(f.key)} className={ICON_BUTTON}>
              <X className="size-3" aria-hidden="true" />
            </button>
          </li>
        ))}
        {chosen.length === 0 && <li className="text-xs text-stone-500">Pick at least one column to see the report.</li>}
      </ul>
      {full ? (
        <p className="text-xs text-stone-500">A report can show at most {CUSTOM_MAX_COLUMNS} columns.</p>
      ) : (
        <FieldSelect fields={remaining} value="" onChange={(key) => key && onToggle(key)} label={ADD_LABEL} emptyLabel={`${ADD_LABEL}…`} />
      )}
    </div>
  );
}

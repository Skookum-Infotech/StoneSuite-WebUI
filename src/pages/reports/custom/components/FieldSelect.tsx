import { Select } from "@/components/ui/select";
import type { CatalogField } from "@/types/customReports";
import { SELECT_CLASS } from "./builderStyles";

interface FieldSelectProps {
  fields: CatalogField[];
  value: string;
  onChange: (key: string) => void;
  /** Accessible name, e.g. "Group by field". */
  label: string;
  /** Text for the empty choice; omit when a field must always be chosen. */
  emptyLabel?: string;
}

const OWN_FIELDS_GROUP = "This record";

/** A field picker: the source's own fields first, then each linked record's
 *  fields under its name (Customer, Invoice, Item…). */
export function FieldSelect({ fields, value, onChange, label, emptyLabel }: FieldSelectProps) {
  const groups = new Map<string, CatalogField[]>();
  for (const field of fields) {
    const name = field.group === "" ? OWN_FIELDS_GROUP : field.group;
    groups.set(name, [...(groups.get(name) ?? []), field]);
  }
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {[...groups.entries()].map(([name, list]) => (
        <optgroup key={name} label={name}>
          {list.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

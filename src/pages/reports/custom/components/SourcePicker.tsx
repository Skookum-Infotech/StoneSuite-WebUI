import { Select } from "@/components/ui/select";
import type { CatalogSource } from "@/types/customReports";
import { SECTION_TITLE, SELECT_CLASS } from "./builderStyles";

interface SourcePickerProps {
  sources: CatalogSource[];
  value: string;
  onChange: (source: CatalogSource) => void;
}

/** What the report is about. Changing it starts the report over. */
export function SourcePicker({ sources, value, onChange }: SourcePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className={SECTION_TITLE}>Source</h3>
      <Select
        aria-label="Source"
        value={value}
        onChange={(e) => {
          const next = sources.find((s) => s.key === e.target.value);
          if (next && next.key !== value) onChange(next);
        }}
        className={SELECT_CLASS}
      >
        {sources.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

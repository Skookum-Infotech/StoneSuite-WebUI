import { cn } from "@/lib/utils";

interface ReportChipGroupProps<T extends string | number> {
  /** Accessible group name; also prefixes each chip's aria-label. */
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

const CHIP_BASE =
  "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400";
const CHIP_ON = "border-stone-900 bg-stone-900 text-white";
const CHIP_OFF = "border-stone-200 bg-white text-stone-600 hover:bg-stone-50";

/** A single-choice row of pill buttons (date presets, basis, bucket, idle days). */
export function ReportChipGroup<T extends string | number>({ label, value, options, onChange }: ReportChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={`${label}: ${o.label}`}
          onClick={() => onChange(o.value)}
          className={cn(CHIP_BASE, value === o.value ? CHIP_ON : CHIP_OFF)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

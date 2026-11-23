import { SlidersHorizontal } from "lucide-react";

interface SelectionStripProps {
  count: number;
  // The configure panel is already showing, so the shortcut isn't needed.
  panelOpen: boolean;
  onConfigure: () => void;
  onClear: () => void;
}

// Sits under the member list while rows are ticked: how many, and a way back
// into the Configure panel after opening a single member's profile.
export function SelectionStrip({ count, panelOpen, onConfigure, onClear }: SelectionStripProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-stone-100 bg-white px-3 py-2">
      <p className="text-xs font-semibold text-stone-700">{count} selected</p>
      <div className="flex items-center gap-2">
        {!panelOpen && (
          <button
            type="button"
            onClick={onConfigure}
            aria-label={`Configure ${count} selected`}
            className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-2xs font-semibold text-stone-950 transition hover:bg-brand-hover"
          >
            <SlidersHorizontal className="size-3" aria-hidden="true" />
            Configure
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection in list"
          className="text-2xs font-semibold text-stone-500 transition-colors hover:text-stone-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

import { SlidersHorizontal } from "lucide-react";

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
      <p className="text-xs font-semibold text-ink">{count} selected</p>
      <div className="flex items-center gap-2">
        {!panelOpen && (
          <button
            type="button"
            onClick={onConfigure}
            aria-label={`Configure ${count} selected`}
            className={cn(buttonVariants({ size: 'sm' }), 'flex')}
          >
            <SlidersHorizontal className="size-3" aria-hidden="true" />
            Configure
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection in list"
          className="text-micro font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

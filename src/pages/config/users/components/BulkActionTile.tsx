import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionTileProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  // How many of the selected members this reaches.
  count: number;
  ariaLabel: string;
  onClick: () => void;
}

// One choice in the bulk panel. Greyed out, with the reason, when none of the
// selected members need it.
export function BulkActionTile({ icon: Icon, label, hint, count, ariaLabel, onClick }: BulkActionTileProps) {
  const idle = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={idle}
      aria-label={ariaLabel}
      className={cn(
        "flex flex-1 items-start gap-3 rounded-xl border border-stone-200 p-3 text-left transition",
        idle ? "cursor-not-allowed opacity-50" : "hover:border-brand/40 hover:bg-brand/5",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-stone-800">{label}</span>
        <span className="block text-2xs text-stone-500">{idle ? "Nothing selected needs this" : hint}</span>
      </span>
      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
        {count}
      </span>
    </button>
  );
}

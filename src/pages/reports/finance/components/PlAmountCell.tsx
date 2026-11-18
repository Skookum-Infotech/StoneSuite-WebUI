import { formatMoney } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";

interface PlAmountCellProps {
  value: number;
  strong?: boolean;
}

/** A right-aligned money cell; negatives are red, subtotals bold. */
export function PlAmountCell({ value, strong }: PlAmountCellProps) {
  return (
    <td className={cn("px-3 py-1.5 text-right tabular-nums", strong ? "font-semibold text-ink-strong" : "text-ink", value < 0 && "text-danger-ink")}>
      {formatMoney(value)}
    </td>
  );
}

import { formatMoney } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";

interface PlAmountCellProps {
  value: number;
  strong?: boolean;
}

/** A right-aligned money cell; negatives are red, subtotals bold. */
export function PlAmountCell({ value, strong }: PlAmountCellProps) {
  return (
    <td className={cn("px-3 py-1.5 text-right tabular-nums", strong ? "font-semibold text-stone-900" : "text-stone-700", value < 0 && "text-red-700")}>
      {formatMoney(value)}
    </td>
  );
}

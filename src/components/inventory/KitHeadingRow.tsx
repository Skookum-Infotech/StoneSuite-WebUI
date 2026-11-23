import { Boxes, Trash2 } from 'lucide-react';

/** Classes for a line that sits under a kit heading: a faint violet wash with a
 *  violet rail down its left edge, so a run of lines reads as one group and a
 *  plain line after it does not read as part of it. */
export const KIT_ROW_CLS =
  'bg-violet-50/50 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-violet-300';

/** The heading row of a kit's lines in an items table: one cell across the whole
 *  row, in a colour no ordinary line uses. `onRemove` is only passed by an
 *  editable table; it takes the whole group out. */
export function KitHeadingRow({ name, count, colSpan, onRemove }: {
  name: string;
  count: number;
  colSpan: number;
  onRemove?: () => void;
}) {
  const label = count === 1 ? 'item' : 'items';
  return (
    <tr aria-label={`Kit ${name}`} className="bg-violet-100">
      <td colSpan={colSpan} className="border-l-4 border-l-violet-600 px-3 py-2">
        <div className="flex items-center gap-2">
          <Boxes className="size-3.5 shrink-0 text-violet-700" aria-hidden="true" />
          <span className="shrink-0 rounded bg-violet-700 px-1.5 py-px text-2xs font-bold uppercase tracking-wide text-white">
            Kit
          </span>
          <span className="min-w-0 truncate text-xs font-semibold text-violet-950">{name}</span>
          <span className="shrink-0 text-2xs text-violet-700">{count} {label}</span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove kit ${name} and its ${count} ${label}`}
              className="ml-auto shrink-0 rounded p-0.5 text-violet-400 transition-colors hover:bg-violet-200 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

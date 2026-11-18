/** The read-only thickness cell of a saved purchase-order line, in the unit the
 *  line was measured in ("0.75 in"); a dash when the line states none. */
export function LineThicknessViewCell({ value, unit }: {
  value?: string | number | null;
  unit?: string | null;
}) {
  const blank = value === null || value === undefined || value === '';
  return (
    <td className="type-cell px-2.5 py-2.5 tabular-nums text-right whitespace-nowrap">
      {blank ? '—' : `${value} ${unit || 'in'}`}
    </td>
  );
}

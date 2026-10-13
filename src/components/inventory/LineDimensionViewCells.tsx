type Dimension = string | number | null | undefined;

/** The three read-only cells — length, width, slabs — of a saved line-item row.
 *  Length and width show the unit they were measured in ("120 in"); each shows a
 *  dash when the line doesn't state it. Accepts the saved line's numbers as well
 *  as an editable row's strings. */
export function LineDimensionViewCells({ length, width, slabs, unit }: {
  length?: Dimension;
  width?: Dimension;
  slabs?: Dimension;
  unit?: string | null;
}) {
  const cellCls = 'px-2.5 py-2.5 tabular-nums text-right text-stone-600 whitespace-nowrap';
  const blank = (v: Dimension) => v === null || v === undefined || v === '';
  const size = (v: Dimension) => (blank(v) ? '—' : `${v} ${unit || 'cm'}`);
  return (
    <>
      <td className={cellCls}>{size(length)}</td>
      <td className={cellCls}>{size(width)}</td>
      <td className={cellCls}>{blank(slabs) ? '—' : String(slabs)}</td>
    </>
  );
}

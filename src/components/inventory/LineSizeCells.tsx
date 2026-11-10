import { LineDimensionInputCells } from '@/components/inventory/LineDimensionInputCells';
import { LineDimensionViewCells } from '@/components/inventory/LineDimensionViewCells';
import { LineThicknessInputCell } from '@/components/inventory/LineThicknessInputCell';
import { LineThicknessViewCell } from '@/components/inventory/LineThicknessViewCell';
import { isAreaUnit, normalizeUnit, type DimensionField } from '@/lib/lineDimensions';

/** How many table columns the slab-size cells span: Length, Width, Slabs, Thick. */
export const SIZE_COLUMN_COUNT = 4;

type Stated = string | number | null | undefined;

const isStated = (v: Stated) => v !== null && v !== undefined && v !== '';

/** A line whose unit is something other than sq ft / sq m — Each, a service, a
 *  sink — has no slab, so length, width, slabs and thickness mean nothing on it.
 *  Its four cells fold into one quiet dash instead of four greyed-out boxes. A
 *  line with no unit yet (no item picked) still shows the boxes, since the unit
 *  decides which kind of row it will become. */
const foldsAway = (units: string | undefined) => Boolean(units?.trim()) && !isAreaUnit(units);

const foldedCellCls = 'px-2.5 py-2.5 text-center text-stone-500';

/** The four editable slab-size cells of a line-item row (length, width, slabs,
 *  thickness), or one merged cell when the line's unit is not an area unit. */
export function LineSizeInputCells({ dims, dimensionUnit, units, onChange }: {
  dims: Record<DimensionField | 'thickness', string>;
  dimensionUnit: string | undefined;
  units: string | undefined;
  onChange: (key: DimensionField | 'thickness', value: string) => void;
}) {
  if (foldsAway(units)) {
    return <td colSpan={SIZE_COLUMN_COUNT} className={foldedCellCls} title="Sold by quantity — no slab size">—</td>;
  }
  const enabled = isAreaUnit(units);
  return (
    <>
      <LineDimensionInputCells
        dims={dims}
        unit={normalizeUnit(dimensionUnit)}
        enabled={enabled}
        onChange={onChange}
      />
      <LineThicknessInputCell
        value={dims.thickness}
        unit={dimensionUnit}
        enabled={enabled}
        onChange={(val) => onChange('thickness', val)}
      />
    </>
  );
}

/** The four read-only slab-size cells of a saved line, or one merged cell for a
 *  line that is sold by quantity and states no size. `size` is the line itself —
 *  only its length, width, slabs and thickness are read. */
export function LineSizeViewCells({ size, unit, units }: {
  size: { length?: Stated; width?: Stated; slabs?: Stated; thickness?: Stated };
  unit?: string | null;
  units?: string;
}) {
  const sizeStated = [size.length, size.width, size.slabs, size.thickness].some(isStated);
  if (foldsAway(units) && !sizeStated) {
    return <td colSpan={SIZE_COLUMN_COUNT} className={foldedCellCls}>—</td>;
  }
  return (
    <>
      <LineDimensionViewCells length={size.length} width={size.width} slabs={size.slabs} unit={unit} />
      <LineThicknessViewCell value={size.thickness} unit={unit} />
    </>
  );
}

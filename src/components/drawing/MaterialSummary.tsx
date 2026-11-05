// Left-panel "Materials" section: how much stone the drawing uses per
// sales-order line, set against the line's ordered quantity when that is in
// square feet. Quantities only — no pricing. Not a slab-consumption estimate.

import { materialUsage } from '@/lib/drawing/materials';
import { mm2ToSqFt } from '@/lib/drawing/metrics';
import { useDrawingEditor } from './DrawingEditorContext';
import { PanelSection } from './PanelSection';

const AREA_UNIT_CODE = 'SQFT';

const sqFt = (mm2: number): string => mm2ToSqFt(mm2).toFixed(1);

export function MaterialSummary({ bare }: { bare?: boolean } = {}) {
  const { state, materialLines } = useDrawingEditor();
  const usage = materialUsage(state.present.areas);
  if (usage.length === 0) return null;

  return (
    <PanelSection title="Materials" bare={bare}>
      {usage.map((u) => {
        const line = materialLines.find((l) => l.id === u.lineId);
        const ordered = line?.unitCode === AREA_UNIT_CODE ? line.quantity : undefined;
        return (
          <div key={u.lineId ?? 'none'} className="rounded border border-stone-200 p-1.5 text-xs text-stone-700">
            <div className="font-medium">{line ? `${line.sku} — ${line.itemName}` : 'No material line'}</div>
            <div>{u.pieceCount} {u.pieceCount === 1 ? 'piece' : 'pieces'} · {sqFt(u.billableAreaMm2)} sq ft</div>
            {u.verticalAreaMm2 > 0 && (
              <div className="text-2xs text-stone-500">
                includes {sqFt(u.verticalAreaMm2)} sq ft of backsplash / waterfall
              </div>
            )}
            {ordered !== undefined && <div className="text-2xs text-stone-500">Ordered {ordered.toFixed(1)} sq ft</div>}
            {!line && <div className="text-2xs text-amber-700">Choose a material line for these pieces.</div>}
          </div>
        );
      })}
    </PanelSection>
  );
}

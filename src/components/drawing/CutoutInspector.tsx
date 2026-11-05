// Right-panel inspector for the selected cutout: what it is, which inventory
// item it is cut for, its edge treatment, and (via CutoutGeometryFields) its
// exact size and position.

import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/select';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import { inventoryService } from '@/services/inventoryService';
import { drawingService } from '@/services/drawingService';
import type { Cutout, CutoutType, Piece } from '@/types/drawing';
import { CUTOUT_TYPES, CUTOUT_TYPE_LABELS } from '@/lib/drawing/cutouts';
import { CutoutGeometryFields } from './CutoutGeometryFields';
import { useDrawingEditor } from './DrawingEditorContext';

export function CutoutInspector({ piece, cutout }: { piece: Piece; cutout: Cutout }) {
  const { state, dispatch } = useDrawingEditor();
  const edgeCodes = useQuery({ queryKey: ['drawing-edge-codes'], queryFn: () => drawingService.getEdgeCodes(), staleTime: Infinity });
  const itemQuery = useQuery({
    queryKey: ['inventory-item', cutout.inventoryItemId],
    queryFn: () => inventoryService.getItem(cutout.inventoryItemId as string),
    enabled: Boolean(cutout.inventoryItemId),
  });

  const patch = (change: Partial<Cutout>) =>
    dispatch({ type: 'updateCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id, patch: change });
  const name = cutout.label || CUTOUT_TYPE_LABELS[cutout.type];

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-stone-800">{name}</h3>
        <button
          type="button"
          aria-label={`Back to ${piece.label}`}
          onClick={() => dispatch({ type: 'selectCutout', pieceId: piece.id, cutoutId: null })}
          className="rounded border border-stone-200 px-2 py-1"
        >
          Back to piece
        </button>
      </div>

      <label className="flex flex-col gap-0.5">
        Label
        <input
          aria-label="Cutout label"
          defaultValue={cutout.label ?? ''}
          key={cutout.id}
          onBlur={(e) => { if ((cutout.label ?? '') !== e.target.value.trim()) patch({ label: e.target.value.trim() || undefined }); }}
          className="rounded border border-stone-200 px-1.5 py-1"
        />
      </label>

      <label className="flex flex-col gap-0.5">
        Type
        <Select
          aria-label="Cutout type"
          value={cutout.type}
          onChange={(e) => patch({ type: e.target.value as CutoutType })}
          className="rounded border border-stone-200 px-1.5 py-1"
        >
          {CUTOUT_TYPES.map((t) => <option key={t} value={t}>{CUTOUT_TYPE_LABELS[t]}</option>)}
        </Select>
      </label>

      <CutoutGeometryFields piece={piece} cutout={cutout} />

      <label className="flex flex-col gap-0.5">
        Edge treatment
        <Select
          aria-label="Cutout edge treatment"
          value={cutout.edgeCode ?? ''}
          onChange={(e) => patch({ edgeCode: e.target.value || undefined })}
          className="rounded border border-stone-200 px-1.5 py-1"
        >
          <option value="">— none —</option>
          {(edgeCodes.data ?? []).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </Select>
      </label>

      <div className="flex flex-col gap-0.5">
        <span>Inventory item</span>
        <ItemPicker
          value={itemQuery.data ?? null}
          onChange={(item) => patch({ inventoryItemId: item?.id })}
        />
      </div>

      <button
        type="button"
        aria-label={`Delete ${name}`}
        onClick={() => dispatch({ type: 'deleteCutout', areaId: state.activeAreaId, pieceId: piece.id, cutoutId: cutout.id })}
        className="self-start rounded border border-stone-200 px-2 py-1 text-destructive"
      >
        Delete cutout
      </button>
    </div>
  );
}

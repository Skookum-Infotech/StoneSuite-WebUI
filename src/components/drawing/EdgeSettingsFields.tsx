// The editable settings of one side: edge profile, overhang, backsplash and
// waterfall. Heights are lengths in the drawing's display unit; 0 clears one.

import type { Piece } from '@/types/drawing';
import { edgeAt, edgeSettingsProblem, setEdgeSettings, type EdgeSettings } from '@/lib/drawing/edges';
import { useDrawingEditor } from './DrawingEditorContext';
import { LengthInput } from './LengthInput';
import { useEdgeCodes } from './useEdgeCodes';

type HeightKey = 'overhangMm' | 'splashHeightMm' | 'waterfallHeightMm';

const HEIGHTS: { key: HeightKey; label: string }[] = [
  { key: 'overhangMm', label: 'Overhang' },
  { key: 'splashHeightMm', label: 'Backsplash height' },
  { key: 'waterfallHeightMm', label: 'Waterfall height' },
];

export function EdgeSettingsFields({ piece, index }: { piece: Piece; index: number }) {
  const { state, dispatch } = useDrawingEditor();
  const codes = useEdgeCodes();
  const edge = edgeAt(piece.edges, index);
  const side = `Side ${index + 1}`;

  const apply = (patch: EdgeSettings): string | null => {
    const problem = edgeSettingsProblem(patch);
    if (problem) return problem;
    dispatch({
      type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id,
      patch: { edges: setEdgeSettings(piece.edges, index, patch) },
    });
    return null;
  };

  return (
    <div className="mt-1 flex flex-col gap-1">
      <label className="flex flex-col gap-0.5">
        {side} edge profile
        <select
          aria-label={`${side} edge profile`}
          value={edge.code ?? ''}
          onChange={(e) => apply({ code: e.target.value || undefined })}
          className="rounded border border-stone-200 px-1.5 py-1"
        >
          <option value="">— unfinished —</option>
          {codes.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </label>
      {HEIGHTS.map(({ key, label }) => (
        <LengthInput
          key={key}
          label={`${side} ${label.toLowerCase()}`}
          valueMm={edge[key] ?? 0}
          onCommit={(mm) => apply({ [key]: mm > 0 ? mm : undefined })}
        />
      ))}
    </div>
  );
}

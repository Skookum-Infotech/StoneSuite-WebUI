// The Corner tool's bottom bar ("Applying Clip"): the six changes to switch
// between, a Close button, and — once a corner has been clicked — the
// measurements for it, or a note when it already carries a change.

import { CORNER_STYLES, cornerChangeAt, cornerStyleDef, type CornerStyle } from '@/lib/drawing/corners';
import { CornerExisting } from './CornerExisting';
import { CornerForm } from './CornerForm';
import { CornerStyleIcon } from './CornerStyleIcon';
import { useDrawingEditor } from './DrawingEditorContext';
import { ToolModeBar } from './ToolModeBar';

const CHOICES = CORNER_STYLES.map(({ id, label }) => ({ id, label, icon: <CornerStyleIcon style={id} className="h-5 w-5" /> }));

export function CornerModeBar() {
  const { tool, setTool, state, corner } = useDrawingEditor();
  if (tool !== 'corner') return null;

  const pieces = state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [];
  const piece = corner.target ? pieces.find((p) => p.id === corner.target?.pieceId) : undefined;
  const vertexIndex = corner.target?.vertexIndex ?? -1;
  const picked = piece !== undefined && vertexIndex >= 0 && vertexIndex < piece.outline.length;
  const existing = picked && cornerChangeAt(piece.edges, vertexIndex, piece.outline.length) !== null;

  return (
    <ToolModeBar
      name="Corner tool"
      title={`Applying ${cornerStyleDef(corner.style).label}`}
      choices={{ items: CHOICES, activeId: corner.style, onPick: (id) => corner.setStyle(id as CornerStyle) }}
      onClose={() => setTool('select')}
    >
      {picked && existing && <CornerExisting key={`${piece.id}:${vertexIndex}`} piece={piece} vertexIndex={vertexIndex} />}
      {picked && !existing && (
        <CornerForm key={`${corner.style}:${piece.id}:${vertexIndex}`} piece={piece} vertexIndex={vertexIndex} />
      )}
    </ToolModeBar>
  );
}

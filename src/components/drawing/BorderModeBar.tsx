// The Border tool's bottom bar ("Applying Full Radius Out"): the six reshapes
// to switch between, a Close button, and — once a side has been clicked — the
// measurements for it, or a note when it already carries a change.

import { BORDER_STYLES, borderOn, borderStyleDef, type BorderStyle } from '@/lib/drawing/borders';
import { edgeLetter } from '@/lib/drawing/labels';
import { BorderExisting } from './BorderExisting';
import { BorderForm } from './BorderForm';
import { BorderStyleIcon } from './BorderStyleIcon';
import { useDrawingEditor } from './DrawingEditorContext';
import { ToolModeBar } from './ToolModeBar';

const CHOICES = BORDER_STYLES.map(({ id, label }) => ({ id, label, icon: <BorderStyleIcon style={id} className="h-5 w-5" /> }));

export function BorderModeBar() {
  const { tool, setTool, state, border } = useDrawingEditor();
  if (tool !== 'border') return null;

  const pieces = state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [];
  const piece = border.target ? pieces.find((p) => p.id === border.target?.pieceId) : undefined;
  const edgeIndex = border.target?.edgeIndex ?? -1;
  const picked = piece !== undefined && edgeIndex >= 0 && edgeIndex < piece.outline.length;
  const existing = picked && borderOn(piece.edges, edgeIndex) !== undefined;
  const cornerOwned = picked && piece.edges.some((e) => e.index === edgeIndex && e.cornerId !== undefined);

  return (
    <ToolModeBar
      name="Border tool"
      title={`Applying ${borderStyleDef(border.style).label}`}
      choices={{ items: CHOICES, activeId: border.style, onPick: (id) => border.setStyle(id as BorderStyle) }}
      onClose={() => setTool('select')}
    >
      {picked && existing && <BorderExisting key={`${piece.id}:${edgeIndex}`} piece={piece} edgeIndex={edgeIndex} />}
      {picked && !existing && cornerOwned && (
        <p role="status" className="max-w-xs text-xs text-stone-300">
          Side {edgeLetter(edgeIndex)} belongs to a corner change. Make that corner standard with the Corner tool before
          applying a border.
        </p>
      )}
      {picked && !existing && !cornerOwned && (
        <BorderForm key={`${border.style}:${piece.id}:${edgeIndex}`} piece={piece} edgeIndex={edgeIndex} />
      )}
    </ToolModeBar>
  );
}

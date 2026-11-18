// The tool rail down the left of the board: a slim dark pill holding the
// tools you draw with — Select (the pointer), Draw (drops and resizes
// pieces), Text, Border (reshapes a side into a curve or a bump), Corner
// (clips, rounds, bumps or notches a corner) and Edges (paints a side in one of
// the shop's edge types); Border and Corner open a flyout that picks which, Edges
// picks its type in the bottom bar. Cutouts and materials live
// under their own tabs in the top bar, so nothing else belongs here. The armed
// tool lights up lime, the same accent as the bottom bar; a tool's name appears
// beside it on hover or keyboard focus. Pressing an armed tool again hands back
// to Select.

import type { LucideIcon } from 'lucide-react';
import { MousePointer2, Pencil, SquareDashed, SquareRoundCorner, TriangleRight, Type } from 'lucide-react';
import { BORDER_STYLES, type BorderStyle } from '@/lib/drawing/borders';
import { CORNER_STYLES, type CornerStyle } from '@/lib/drawing/corners';
import { useDrawingEditor, type EditorTool } from './DrawingEditorContext';
import { BorderStyleIcon } from './BorderStyleIcon';
import { CornerStyleIcon } from './CornerStyleIcon';
import { RailFlyoutButton, type RailFlyoutTool } from './RailFlyoutButton';
import { RAIL_BUTTON_CLASS, RAIL_NAME_CLASS } from './railStyles';

interface ToolDef {
  tool: EditorTool;
  label: string;
  Icon: LucideIcon;
}

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Select', Icon: MousePointer2 },
  { tool: 'draw', label: 'Draw', Icon: Pencil },
  { tool: 'text', label: 'Text', Icon: Type },
];

/** After Border and Corner, so the rail reads Select, Draw, Text, Border, Corner, Edges. */
const EDGES_TOOL: ToolDef = { tool: 'edge', label: 'Edges', Icon: TriangleRight };

const BORDER_TOOL: RailFlyoutTool = { label: 'Border', hint: 'Border (B)', title: 'Borders (B)', Icon: SquareDashed };
const CORNER_TOOL: RailFlyoutTool = { label: 'Corner', hint: 'Corner (C)', title: 'Corners (C)', Icon: SquareRoundCorner };

/** A plain rail button: arms its tool, or hands back to Select if it is already armed. */
function PlainToolButton({ def }: { def: ToolDef }) {
  const { tool, setTool } = useDrawingEditor();
  const { tool: id, label, Icon } = def;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-pressed={tool === id}
        onClick={() => setTool(id === 'select' || tool === id ? 'select' : id)}
        className={RAIL_BUTTON_CLASS}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
      {/* Beside the button, over the canvas — the rail is too narrow to hold names. */}
      <span aria-hidden="true" className={RAIL_NAME_CLASS}>{label}</span>
    </div>
  );
}

export function ToolRail() {
  const { tool, setTool, border, corner } = useDrawingEditor();

  return (
    <nav aria-label="Drawing tools" className="flex flex-col items-center">
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-stone-900 p-1.5 shadow-lg">
        {TOOLS.map((def) => <PlainToolButton key={def.tool} def={def} />)}

        <RailFlyoutButton
          tool={BORDER_TOOL}
          armed={tool === 'border'}
          items={BORDER_STYLES.map(({ id, label }) => ({
            id, label, active: tool === 'border' && border.style === id, icon: <BorderStyleIcon style={id} className="h-5 w-5" />,
          }))}
          onPick={(id) => {
            border.setStyle(id as BorderStyle);
            setTool('border');
          }}
          onDisarm={() => setTool('select')}
        />

        <RailFlyoutButton
          tool={CORNER_TOOL}
          armed={tool === 'corner'}
          items={CORNER_STYLES.map(({ id, label }) => ({
            id, label, active: tool === 'corner' && corner.style === id, icon: <CornerStyleIcon style={id} className="h-5 w-5" />,
          }))}
          onPick={(id) => {
            corner.setStyle(id as CornerStyle);
            setTool('corner');
          }}
          onDisarm={() => setTool('select')}
        />

        <PlainToolButton def={EDGES_TOOL} />
      </div>
    </nav>
  );
}

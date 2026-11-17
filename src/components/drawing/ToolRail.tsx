// The tool rail down the left of the board: a slim dark pill holding the
// tools you draw with — Select (the pointer), Draw (drops and resizes
// pieces), Text, and Border (reshapes a side into a curve or a bump; its
// flyout picks which). Corner and Edges sit below it, still to come. Cutouts
// and materials live under their own tabs in the top bar, so nothing else
// belongs here. The armed tool lights up lime, the same accent as the bottom
// bar; a tool's name appears beside it on hover or keyboard focus. Pressing an
// armed tool again hands back to Select.

import { useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { MousePointer2, Pencil, SquareDashed, SquareRoundCorner, TriangleRight, Type } from 'lucide-react';
import { BORDER_STYLES, type BorderStyle } from '@/lib/drawing/borders';
import { useDrawingEditor, type EditorTool } from './DrawingEditorContext';
import { BorderStyleIcon } from './BorderStyleIcon';
import { ToolFlyout } from './ToolFlyout';

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

/** Rail tools whose options open in a flyout, not built yet. */
const COMING_SOON: { label: string; Icon: LucideIcon }[] = [
  { label: 'Corner', Icon: SquareRoundCorner },
  { label: 'Edges', Icon: TriangleRight },
];

const BUTTON_CLASS = 'peer relative flex h-10 w-10 items-center justify-center rounded-xl text-stone-300 transition-colors hover:bg-stone-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-stone-600 disabled:hover:bg-transparent disabled:hover:text-stone-600 aria-pressed:bg-brand aria-pressed:text-stone-900 aria-pressed:shadow-sm';
const NAME_CLASS = 'pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100';
/** The corner notch that says "this opens a list". */
const FLYOUT_MARK_CLASS = 'absolute bottom-1 right-1 h-0 w-0 border-b-[5px] border-l-[5px] border-b-current border-l-transparent';

export function ToolRail() {
  const { tool, setTool, border } = useDrawingEditor();
  const [borderMenuOpen, setBorderMenuOpen] = useState(false);
  const borderButton = useRef<HTMLButtonElement>(null);

  const pickBorder = (id: string) => {
    border.setStyle(id as BorderStyle);
    setBorderMenuOpen(false);
    setTool('border');
  };

  return (
    <nav aria-label="Drawing tools" className="flex shrink-0 flex-col items-center px-2 py-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-stone-900 p-1.5 shadow-lg">
        {TOOLS.map(({ tool: id, label, Icon }) => (
          <div key={id} className="relative">
            <button
              type="button"
              aria-label={label}
              aria-pressed={tool === id}
              onClick={() => setTool(id === 'select' || tool === id ? 'select' : id)}
              className={BUTTON_CLASS}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
            {/* Beside the button, over the canvas — the rail is too narrow to hold names. */}
            <span aria-hidden="true" className={NAME_CLASS}>{label}</span>
          </div>
        ))}

        <div className="relative">
          <button
            type="button"
            ref={borderButton}
            aria-label="Border"
            aria-pressed={tool === 'border'}
            aria-haspopup="menu"
            aria-expanded={borderMenuOpen}
            onClick={() => {
              if (tool === 'border') setTool('select');
              else setBorderMenuOpen((open) => !open);
            }}
            className={BUTTON_CLASS}
          >
            <SquareDashed className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            <span aria-hidden="true" className={FLYOUT_MARK_CLASS} />
          </button>
          {!borderMenuOpen && <span aria-hidden="true" className={NAME_CLASS}>Border (B)</span>}
          {borderMenuOpen && (
            <ToolFlyout
              title="Borders (B)"
              items={BORDER_STYLES.map(({ id, label }) => ({
                id, label, active: tool === 'border' && border.style === id, icon: <BorderStyleIcon style={id} className="h-5 w-5" />,
              }))}
              onPick={pickBorder}
              onClose={(reason) => {
                setBorderMenuOpen(false);
                if (reason === 'escape') borderButton.current?.focus();
              }}
            />
          )}
        </div>

        {COMING_SOON.map(({ label, Icon }) => (
          <div key={label} className="relative">
            <button type="button" aria-label={label} disabled title="Coming soon" className={BUTTON_CLASS}>
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              <span aria-hidden="true" className={FLYOUT_MARK_CLASS} />
            </button>
          </div>
        ))}
      </div>
    </nav>
  );
}

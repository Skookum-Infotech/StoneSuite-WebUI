// The tool rail down the left of the board: a slim dark pill holding the
// tools you draw with — Select (the pointer), Draw (drops and resizes
// pieces) and Text. Cutouts and materials live under their own tabs in the
// top bar, so nothing else belongs here. The armed tool lights up lime, the
// same accent as the bottom bar; a tool's name appears beside it on hover or
// keyboard focus. Pressing an armed tool again hands back to Select.

import type { LucideIcon } from 'lucide-react';
import { MousePointer2, Pencil, Type } from 'lucide-react';
import { useDrawingEditor, type EditorTool } from './DrawingEditorContext';

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

const BUTTON_CLASS = 'peer flex h-10 w-10 items-center justify-center rounded-xl text-stone-300 transition-colors hover:bg-stone-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-brand aria-pressed:text-stone-900 aria-pressed:shadow-sm';

export function ToolRail() {
  const { tool, setTool } = useDrawingEditor();

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
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </nav>
  );
}

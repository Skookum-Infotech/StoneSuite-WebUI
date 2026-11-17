// The strip at the bottom centre of the canvas while the Border tool is armed
// ("Applying Full Radius Out"): the six reshapes to switch between, a Close
// button, and — once a side has been clicked — the measurements for it.

import { useEffect } from 'react';
import { BORDER_STYLES, borderOn, borderStyleDef } from '@/lib/drawing/borders';
import { BorderExisting } from './BorderExisting';
import { BorderForm } from './BorderForm';
import { BorderStyleIcon } from './BorderStyleIcon';
import { useDrawingEditor } from './DrawingEditorContext';

const STYLE_BUTTON_CLASS = 'flex h-9 w-11 items-center justify-center rounded text-stone-200 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-brand aria-pressed:text-stone-900';

export function BorderModeBar() {
  const { tool, setTool, state, border } = useDrawingEditor();
  const armed = tool === 'border';

  // Esc closes the tool wherever focus is — the rail button that armed it
  // keeps focus, which is outside the canvas's own key handler.
  useEffect(() => {
    if (!armed) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTool('select');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [armed, setTool]);

  if (!armed) return null;
  const pieces = state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [];
  const piece = border.target ? pieces.find((p) => p.id === border.target?.pieceId) : undefined;
  const edgeIndex = border.target?.edgeIndex ?? -1;
  const picked = piece !== undefined && edgeIndex >= 0 && edgeIndex < piece.outline.length;
  const existing = picked && borderOn(piece.edges, edgeIndex) !== undefined;

  return (
    <div
      role="group"
      aria-label="Border tool"
      className="pointer-events-auto absolute bottom-3 left-1/2 z-10 flex max-w-[95%] -translate-x-1/2 flex-col gap-2 rounded-lg bg-stone-900 px-3 py-2 shadow-lg"
    >
      <div className="flex items-center justify-between gap-6">
        <h3 className="text-sm font-semibold text-white">Applying {borderStyleDef(border.style).label}</h3>
        <button
          type="button"
          onClick={() => setTool('select')}
          className="rounded-md bg-brand px-3 py-1 text-xs font-semibold text-stone-900 hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          Close (Esc)
        </button>
      </div>
      <div className="flex gap-1 rounded-md border border-stone-700 p-0.5">
        {BORDER_STYLES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={border.style === id}
            title={label}
            onClick={() => border.setStyle(id)}
            className={STYLE_BUTTON_CLASS}
          >
            <BorderStyleIcon style={id} className="h-5 w-5" />
          </button>
        ))}
      </div>
      {picked && existing && <BorderExisting key={`${piece.id}:${edgeIndex}`} piece={piece} edgeIndex={edgeIndex} />}
      {picked && !existing && <BorderForm key={`${border.style}:${piece.id}:${edgeIndex}`} piece={piece} edgeIndex={edgeIndex} />}
    </div>
  );
}

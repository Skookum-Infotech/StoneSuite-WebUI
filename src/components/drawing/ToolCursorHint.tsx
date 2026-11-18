// The small label that rides beside the mouse pointer while a tool that needs
// a click on something specific is armed ("Click on any border"). It follows
// the pointer by writing the position straight onto its own element — a
// re-render per mouse move would be needless work — and hides when the
// pointer leaves the canvas it sits in.

import { useEffect, useRef } from 'react';
import { ColorSwatch } from './ColorSwatch';
import { useDrawingEditor, type EditorTool } from './DrawingEditorContext';
import { useSelectedEdgeType } from './useSelectedEdgeType';

const HINTS: Partial<Record<EditorTool, string>> = {
  border: 'Click on any border',
  corner: 'Click on any corner',
  edge: 'Click on a border to apply',
};

/** Gap between the pointer and the label, in pixels. */
const POINTER_GAP_PX = 16;

export function ToolCursorHint() {
  const { tool } = useDrawingEditor();
  const picked = useSelectedEdgeType();
  const hint = HINTS[tool];
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = label.current;
    const host = el?.parentElement;
    if (!hint || !host || !el) return undefined;
    const move = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      el.style.transform = `translate(${e.clientX - rect.left + POINTER_GAP_PX}px, ${e.clientY - rect.top + POINTER_GAP_PX}px)`;
      el.style.visibility = 'visible';
    };
    const leave = () => {
      el.style.visibility = 'hidden';
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
    };
  }, [hint]);

  if (!hint) return null;
  return (
    <div
      ref={label}
      aria-hidden="true"
      className="pointer-events-none invisible absolute left-0 top-0 z-20 whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-xs font-medium text-white shadow-md"
    >
      {tool === 'edge' && picked ? (
        <>
          <span className="flex items-center gap-1.5 font-semibold">
            <ColorSwatch color={picked.color} className="h-3 w-3" />
            {picked.name}
          </span>
          <span className="block font-normal text-stone-300">{hint}</span>
        </>
      ) : hint}
    </div>
  );
}

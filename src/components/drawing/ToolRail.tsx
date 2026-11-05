// Left-edge icon rail that replaces the old always-open panel list. Each
// icon opens a flyout with that section's tools over the canvas, instead of
// everything being visible (and scrolled through) at once. Only one flyout
// is open at a time; Escape or a click outside closes it.

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { AnnotationPanel } from './AnnotationPanel';
import { CutoutLibrary } from './CutoutLibrary';
import { useDrawingEditor } from './DrawingEditorContext';
import { MaterialSummary } from './MaterialSummary';
import { ShapePalette } from './ShapePalette';
import { CutoutsIcon, LineIcon, MaterialsIcon, NotesIcon, SelectIcon, ShapesIcon } from './ToolRailIcons';

type Section = 'shapes' | 'cutouts' | 'annotations' | 'materials';

interface SectionDef {
  id: Section;
  label: string;
  Icon: typeof ShapesIcon;
  Content: ComponentType<{ bare?: boolean }>;
}

const SECTIONS: SectionDef[] = [
  { id: 'shapes', label: 'Shapes', Icon: ShapesIcon, Content: ShapePalette },
  { id: 'cutouts', label: 'Cutouts', Icon: CutoutsIcon, Content: CutoutLibrary },
  { id: 'annotations', label: 'Annotations', Icon: NotesIcon, Content: AnnotationPanel },
  { id: 'materials', label: 'Materials', Icon: MaterialsIcon, Content: MaterialSummary },
];

const RAIL_BUTTON_CLASS = 'flex h-9 w-9 items-center justify-center rounded text-stone-600 hover:bg-stone-100 aria-pressed:bg-brand/10 aria-pressed:text-brand';

export function ToolRail() {
  const { tool, setTool } = useDrawingEditor();
  const [open, setOpen] = useState<Section | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = SECTIONS.find((s) => s.id === open);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex h-full shrink-0">
      <nav aria-label="Drawing tools" className="flex w-11 flex-col items-center gap-1 border-r border-stone-200 py-1.5">
        <button
          type="button"
          aria-label="Select"
          aria-pressed={tool === 'select'}
          onClick={() => { setTool('select'); setOpen(null); }}
          className={RAIL_BUTTON_CLASS}
        >
          <SelectIcon />
        </button>
        <button
          type="button"
          aria-label="Line"
          aria-pressed={tool === 'line'}
          onClick={() => { setTool(tool === 'line' ? 'select' : 'line'); setOpen(null); }}
          className={RAIL_BUTTON_CLASS}
        >
          <LineIcon />
        </button>
        <span className="my-0.5 h-px w-6 bg-stone-200" aria-hidden="true" />
        {SECTIONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={open === id}
            onClick={() => setOpen((current) => (current === id ? null : id))}
            className={RAIL_BUTTON_CLASS}
          >
            <Icon />
          </button>
        ))}
      </nav>
      {active && (
        <div
          role="region"
          aria-label={active.label}
          className="modal-scrollbar absolute left-full top-0 z-10 max-h-full w-60 overflow-y-auto overflow-x-hidden rounded-r border border-l-0 border-stone-200 bg-white p-2 shadow-lg"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-2xs font-semibold uppercase tracking-wide text-stone-500">{active.label}</h3>
            <button type="button" aria-label={`Close ${active.label}`} onClick={() => setOpen(null)} className="text-stone-400 hover:text-stone-600">
              ✕
            </button>
          </div>
          <active.Content bare />
        </div>
      )}
    </div>
  );
}

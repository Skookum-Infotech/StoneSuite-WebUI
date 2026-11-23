// Left-panel "Annotations" section: the Note and Dimension placement tools,
// and the area's existing notes and manual dimensions to edit or remove.
// Auto-placed side dimensions are not listed — they follow the geometry.

import { useId, useState } from 'react';
import type { Dimension, Note } from '@/types/drawing';
import { dimensionProblem, noteProblem } from '@/lib/drawing/annotations';
import { distance } from '@/lib/drawing/geometry';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor, type EditorTool } from './DrawingEditorContext';
import { LengthInput } from './LengthInput';
import { PanelSection } from './PanelSection';

const BUTTON_CLASS = 'rounded border border-stone-200 px-2 py-1 text-left text-xs aria-pressed:border-brand aria-pressed:bg-brand/10';

export function AnnotationPanel({ bare }: { bare?: boolean } = {}) {
  const { state, dispatch, tool, setTool } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  if (!area) return null;
  const dimensions = area.dimensions ?? [];
  const areaId = area.id;

  const toggle = (next: EditorTool) => setTool(tool === next ? 'select' : next);
  const setNotes = (notes: Note[]) => dispatch({ type: 'setAnnotations', areaId, notes });
  const setDimensions = (next: Dimension[]) => dispatch({ type: 'setAnnotations', areaId, dimensions: next });

  return (
    <PanelSection title="Annotations" bare={bare}>
      <div className="grid grid-cols-2 gap-1.5">
      <button type="button" aria-label="Add note" aria-pressed={tool === 'note'} onClick={() => toggle('note')} className={BUTTON_CLASS}>
        Add note
      </button>
      <button type="button" aria-label="Add dimension" aria-pressed={tool === 'dimension'} onClick={() => toggle('dimension')} className={BUTTON_CLASS}>
        Add dimension
      </button>
      </div>
      {tool === 'note' && <p className="text-2xs text-stone-500">Click the canvas where the note goes.</p>}
      {tool === 'dimension' && <p className="text-2xs text-stone-500">Click two points. Corners snap.</p>}
      {area.notes.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          onChange={(text) => setNotes(area.notes.map((n) => (n.id === note.id ? { ...n, text } : n)))}
          onDelete={() => setNotes(area.notes.filter((n) => n.id !== note.id))}
        />
      ))}
      {dimensions.map((dim, i) => (
        <DimensionRow
          key={dim.id}
          dim={dim}
          index={i}
          onChange={(next) => setDimensions(dimensions.map((d) => (d.id === dim.id ? next : d)))}
          onDelete={() => setDimensions(dimensions.filter((d) => d.id !== dim.id))}
        />
      ))}
    </PanelSection>
  );
}

function NoteRow({ note, onChange, onDelete }: { note: Note; onChange: (text: string) => void; onDelete: () => void }) {
  const [text, setText] = useState(note.text);
  const [seeded, setSeeded] = useState(note.text);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  if (seeded !== note.text) {
    setSeeded(note.text);
    setText(note.text);
    setError(null);
  }
  const commit = () => {
    const problem = noteProblem(text);
    setError(problem);
    if (!problem && text !== note.text) onChange(text);
  };
  return (
    <div className="flex flex-col gap-0.5 rounded border border-stone-200 p-1">
      <input
        aria-label="Note text"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
        className="rounded border border-stone-200 px-1.5 py-1 text-xs"
      />
      {error && <span id={errorId} role="alert" className="text-2xs text-destructive">{error}</span>}
      <button type="button" aria-label={`Delete note ${note.text}`} onClick={onDelete} className="self-end text-2xs text-destructive">
        Delete
      </button>
    </div>
  );
}

function DimensionRow(
  { dim, index, onChange, onDelete }: { dim: Dimension; index: number; onChange: (d: Dimension) => void; onDelete: () => void },
) {
  const { state } = useDrawingEditor();
  const { displayUnit, fractionDenominator } = state.present;
  const name = `Dimension ${index + 1}`;
  return (
    <div className="flex flex-col gap-0.5 rounded border border-stone-200 p-1 text-xs">
      <span>{name}: {formatLength(distance(dim.from, dim.to), displayUnit, fractionDenominator)}</span>
      <LengthInput
        label={`${name} offset`}
        valueMm={Math.abs(dim.offsetMm)}
        onCommit={(mm) => {
          const offsetMm = Math.sign(dim.offsetMm || 1) * mm;
          const problem = dimensionProblem(dim.from, dim.to, offsetMm);
          if (!problem) onChange({ ...dim, offsetMm });
          return problem;
        }}
      />
      <div className="flex justify-between">
        <button
          type="button"
          aria-label={`Flip ${name} to the other side`}
          onClick={() => onChange({ ...dim, from: dim.to, to: dim.from })}
          className="text-2xs underline-offset-2 hover:underline"
        >
          Flip side
        </button>
        <button type="button" aria-label={`Delete ${name}`} onClick={onDelete} className="text-2xs text-destructive">
          Delete
        </button>
      </div>
    </div>
  );
}

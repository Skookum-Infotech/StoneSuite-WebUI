// The control bar that floats at the bottom centre of the board while a piece
// of text is picked: its words (a textarea), Bold, Italic, size, and Delete.
// Edits apply to the board as they are made. Typing is folded into a single
// undo step by the reducer's `updateNote`; Escape (or Done) lets go of the
// text, and text left empty is removed on the way out rather than leaving an
// invisible stray behind.

import { useEffect, useRef, useState } from 'react';
import { Bold, Check, Italic, Minus, Plus, Trash2 } from 'lucide-react';
import {
  clampTextSize, MAX_TEXT_SIZE_PX, MIN_TEXT_SIZE_PX, noteFontSize, TEXT_SIZE_STEP_PX,
} from '@/lib/drawing/textNotes';
import type { Note } from '@/types/drawing';
import { MAX_NOTE_LENGTH } from '@/lib/drawing/annotations';
import { useDrawingEditor } from './DrawingEditorContext';

type NotePatch = Partial<Omit<Note, 'id'>>;

const BUTTON_CLASS = 'flex h-8 w-8 items-center justify-center rounded-md text-stone-200 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-brand aria-pressed:text-ink-strong';
const ICON_CLASS = 'h-4 w-4';
const FOCUS_DELAY_MS = 0;

export function TextControls() {
  const { state, dispatch, selectedNoteId, selectNote } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const note = area?.notes.find((n) => n.id === selectedNoteId);
  const areaId = state.activeAreaId;
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // What is being typed in the size box, or null to show the note's own size.
  const [typedSize, setTypedSize] = useState<string | null>(null);
  const size = note ? noteFontSize(note) : 0;

  // The latest notes, readable from the cleanup below without re-running it.
  const latest = useRef({ notes: area?.notes ?? [], areaId });
  const notesNow = area?.notes;
  useEffect(() => {
    latest.current = { notes: notesNow ?? [], areaId };
    return () => undefined;
  });

  // A newly picked piece of text takes the keyboard, its words selected so
  // typing replaces the placeholder. Deferred a tick: the click that picked
  // the text is still finishing — its mousedown moves focus to the canvas
  // after the pointerdown that got us here — and focusing any sooner would be
  // undone, leaving the box unfocused with typing going nowhere.
  useEffect(() => {
    if (!selectedNoteId) return undefined;
    const timer = setTimeout(() => {
      fieldRef.current?.focus();
      fieldRef.current?.select();
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [selectedNoteId]);

  // Letting go of text that was emptied removes it.
  useEffect(() => {
    if (!selectedNoteId) return undefined;
    return () => {
      const { notes, areaId: lastAreaId } = latest.current;
      const letGo = notes.find((n) => n.id === selectedNoteId);
      if (letGo && letGo.text.trim() === '') {
        dispatch({ type: 'setAnnotations', areaId: lastAreaId, notes: notes.filter((n) => n.id !== letGo.id) });
      }
    };
  }, [selectedNoteId, dispatch]);

  if (!note) return null;

  const update = (patch: NotePatch) =>
    dispatch({ type: 'updateNote', areaId, noteId: note.id, patch });
  const setSize = (next: number) => update({ fontSize: clampTextSize(next) });
  const commitSizeDraft = () => {
    const draft = typedSize ?? '';
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && draft.trim() !== '') setSize(parsed);
    setTypedSize(null);
  };
  const remove = () => {
    dispatch({ type: 'setAnnotations', areaId, notes: (area?.notes ?? []).filter((n) => n.id !== note.id) });
    selectNote(null);
  };

  return (
    <div
      role="toolbar"
      aria-label="Text controls"
      className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-xl bg-stone-900 p-2 text-white shadow-xl"
    >
      <textarea
        ref={fieldRef}
        aria-label="Text content"
        rows={2}
        maxLength={MAX_NOTE_LENGTH}
        value={note.text}
        onChange={(e) => update({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            selectNote(null);
          }
        }}
        className="h-14 w-56 resize-none rounded-md border border-stone-600 bg-stone-800 px-2 py-1 text-sm text-white placeholder:text-ink-muted focus:border-brand focus:outline-none"
        placeholder="Type your text"
      />
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          aria-pressed={note.bold === true}
          onClick={() => update({ bold: note.bold !== true })}
          className={BUTTON_CLASS}
        >
          <Bold className={ICON_CLASS} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          aria-pressed={note.italic === true}
          onClick={() => update({ italic: note.italic !== true })}
          className={BUTTON_CLASS}
        >
          <Italic className={ICON_CLASS} aria-hidden="true" />
        </button>
      </div>
      <div className="flex items-center gap-0.5" role="group" aria-label="Size">
        <button
          type="button"
          aria-label="Smaller text"
          title="Smaller"
          disabled={size <= MIN_TEXT_SIZE_PX}
          onClick={() => setSize(size - TEXT_SIZE_STEP_PX)}
          className={BUTTON_CLASS}
        >
          <Minus className={ICON_CLASS} aria-hidden="true" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label="Text size"
          min={MIN_TEXT_SIZE_PX}
          max={MAX_TEXT_SIZE_PX}
          step={1}
          value={typedSize ?? String(size)}
          onChange={(e) => setTypedSize(e.target.value)}
          onBlur={commitSizeDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitSizeDraft();
          }}
          className="h-8 w-12 rounded-md border border-stone-600 bg-stone-800 text-center text-white focus:border-brand focus:outline-none type-input"
        />
        <button
          type="button"
          aria-label="Larger text"
          title="Larger"
          disabled={size >= MAX_TEXT_SIZE_PX}
          onClick={() => setSize(size + TEXT_SIZE_STEP_PX)}
          className={BUTTON_CLASS}
        >
          <Plus className={ICON_CLASS} aria-hidden="true" />
        </button>
      </div>
      <span className="h-6 w-px bg-stone-700" aria-hidden="true" />
      <button type="button" aria-label="Delete text" title="Delete" onClick={remove} className={`${BUTTON_CLASS} hover:text-red-400`}>
        <Trash2 className={ICON_CLASS} aria-hidden="true" />
      </button>
      <button type="button" aria-label="Done" title="Done" onClick={() => selectNote(null)} className={BUTTON_CLASS}>
        <Check className={ICON_CLASS} aria-hidden="true" />
      </button>
    </div>
  );
}

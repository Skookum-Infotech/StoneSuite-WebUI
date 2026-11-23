// The active area's text on the board — what the Text tool places. Each piece
// of text is drawn at its click point at a fixed on-screen size (so it stays
// readable however far the drawing is zoomed out), with a white halo so it
// reads over a piece's fill. With the Select tool a press on it picks it up
// for the control bar at the bottom; the picked one gets a dashed outline.

import { noteBoxPx, noteFontSize, noteLines, TEXT_LINE_HEIGHT_EM } from '@/lib/drawing/textNotes';
import type { Note } from '@/types/drawing';
import { useDrawingEditor } from './DrawingEditorContext';

const HALO_PX = 3;
const OUTLINE_PAD_PX = 4;
const OUTLINE_DASH_PX = 4;

function TextNote({ note, selected, interactive }: { note: Note; selected: boolean; interactive: boolean }) {
  const { state, selectNote } = useDrawingEditor();
  const px = (value: number) => value / state.zoom;
  const size = noteFontSize(note);
  const { width, height } = noteBoxPx(note);
  const left = note.at.x;
  const anchorY = -note.at.y; // world +y is up; SVG y grows downward
  // The first line is centred on the click point, so the text lands where
  // the finger or cursor was rather than floating above it.
  const top = anchorY - px((size * TEXT_LINE_HEIGHT_EM) / 2);

  const pick = (e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    selectNote(note.id);
  };
  const onKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectNote(note.id);
    }
  };

  return (
    <g
      {...(interactive
        ? { role: 'button', tabIndex: 0, 'aria-label': `Text: ${note.text || 'empty'}`, onPointerDown: pick, onKeyDown, className: 'cursor-pointer outline-none' }
        : { 'aria-hidden': true })}
      pointerEvents={interactive ? 'all' : 'none'}
    >
      {/* The click target: the text box, padded a little so a thin line of
          small text is still easy to hit. */}
      <rect
        x={left - px(OUTLINE_PAD_PX)}
        y={top - px(OUTLINE_PAD_PX)}
        width={px(width + OUTLINE_PAD_PX * 2)}
        height={px(height + OUTLINE_PAD_PX * 2)}
        fill="transparent"
        className={selected ? 'stroke-stone-500' : 'stroke-transparent'}
        strokeWidth={px(1)}
        strokeDasharray={selected ? `${px(OUTLINE_DASH_PX)} ${px(OUTLINE_DASH_PX)}` : undefined}
      />
      <text
        x={left}
        y={anchorY}
        dominantBaseline="central"
        fontSize={px(size)}
        strokeWidth={px(HALO_PX)}
        strokeLinejoin="round"
        paintOrder="stroke"
        className={`fill-stone-900 stroke-white select-none ${note.bold ? 'font-bold' : 'font-normal'} ${note.italic ? 'italic' : 'not-italic'}`}
      >
        {noteLines(note.text).map((line, i) => (
          // Lines have no identity beyond their position; the list is rebuilt
          // from the text on every change.
          <tspan key={i} x={left} dy={i === 0 ? 0 : px(size * TEXT_LINE_HEIGHT_EM)}>{line || ' '}</tspan>
        ))}
      </text>
    </g>
  );
}

export function TextNoteLayer() {
  const { state, tool, workspace, selectedNoteId } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  if (!area) return null;
  return (
    <g>
      {area.notes.map((note) => (
        <TextNote key={note.id} note={note} selected={note.id === selectedNoteId} interactive={tool === 'select' && workspace === 'sketch'} />
      ))}
    </g>
  );
}

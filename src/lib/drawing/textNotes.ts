// The Text tool's pure helpers: the defaults for a freshly placed piece of
// text, the size limits the control bar enforces, and a rough box around the
// text so it can be clicked and outlined without measuring real glyphs.

import type { Note, Point } from '@/types/drawing';

export const DEFAULT_TEXT = 'Text';
export const DEFAULT_TEXT_SIZE_PX = 18;
export const MIN_TEXT_SIZE_PX = 8;
export const MAX_TEXT_SIZE_PX = 96;
/** Step of the size control's − / + buttons. */
export const TEXT_SIZE_STEP_PX = 2;

/** Average glyph width as a multiple of the font size, and line height — an
 *  over-estimate of a normal sans, so the box always covers the text. */
const GLYPH_WIDTH_EM = 0.62;
const BOLD_GLYPH_EXTRA_EM = 0.06;
const LINE_HEIGHT_EM = 1.25;

export function newTextNote(at: Point, id: string): Note {
  return { id, text: DEFAULT_TEXT, at, fontSize: DEFAULT_TEXT_SIZE_PX };
}

export function clampTextSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_TEXT_SIZE_PX;
  return Math.min(MAX_TEXT_SIZE_PX, Math.max(MIN_TEXT_SIZE_PX, Math.round(size)));
}

export function noteFontSize(note: Pick<Note, 'fontSize'>): number {
  return clampTextSize(note.fontSize ?? DEFAULT_TEXT_SIZE_PX);
}

/** The lines of a note, split on newlines. Always at least one (possibly empty). */
export function noteLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** The note's rough box in screen pixels: its width and height, with the
 *  text's first baseline at the box's top-left plus one font size down. */
export function noteBoxPx(note: Pick<Note, 'text' | 'bold' | 'fontSize'>): { width: number; height: number } {
  const size = noteFontSize(note);
  const lines = noteLines(note.text);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const glyph = GLYPH_WIDTH_EM + (note.bold ? BOLD_GLYPH_EXTRA_EM : 0);
  return { width: longest * glyph * size, height: lines.length * LINE_HEIGHT_EM * size };
}

export const TEXT_LINE_HEIGHT_EM = LINE_HEIGHT_EM;

/** Whether a world-space `point` lands on the note. The text is anchored at
 *  the left end of its first line's vertical middle (`note.at`, where the
 *  board was clicked), grows right and down, and keeps its on-screen size, so
 *  the box is measured in pixels and divided by `zoom`. */
export function noteHit(note: Note, point: Point, zoom: number): boolean {
  const size = noteFontSize(note);
  const { width, height } = noteBoxPx(note);
  const left = note.at.x;
  const top = note.at.y + (size * LINE_HEIGHT_EM) / 2 / zoom; // world +y is up: half a line above the anchor
  return point.x >= left && point.x <= left + width / zoom && point.y <= top && point.y >= top - height / zoom;
}

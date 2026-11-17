import { describe, expect, it } from 'vitest';
import {
  clampTextSize, DEFAULT_TEXT, DEFAULT_TEXT_SIZE_PX, MAX_TEXT_SIZE_PX, MIN_TEXT_SIZE_PX, newTextNote, noteBoxPx, noteFontSize,
  noteHit, noteLines,
} from './textNotes';

describe('textNotes', () => {
  it('starts a new piece of text with the default words and size at the click', () => {
    expect(newTextNote({ x: 3, y: 4 }, 'n1')).toEqual({ id: 'n1', text: DEFAULT_TEXT, at: { x: 3, y: 4 }, fontSize: DEFAULT_TEXT_SIZE_PX });
  });

  it.each([
    [1, MIN_TEXT_SIZE_PX],
    [12.6, 13],
    [500, MAX_TEXT_SIZE_PX],
    [Number.NaN, DEFAULT_TEXT_SIZE_PX],
    [Infinity, DEFAULT_TEXT_SIZE_PX],
  ])('clamps a size of %s to %s', (input, expected) => {
    expect(clampTextSize(input)).toBe(expected);
  });

  it('falls back to the default size for a note with none (an older plain note)', () => {
    expect(noteFontSize({})).toBe(DEFAULT_TEXT_SIZE_PX);
    expect(noteFontSize({ fontSize: 40 })).toBe(40);
  });

  it('splits on any newline style and keeps an empty note as one empty line', () => {
    expect(noteLines('a\nb\r\nc')).toEqual(['a', 'b', 'c']);
    expect(noteLines('')).toEqual(['']);
  });

  it('sizes the box from the longest line and the line count, wider when bold', () => {
    const plain = noteBoxPx({ text: 'ab\nabcd', fontSize: 20 });
    const bold = noteBoxPx({ text: 'ab\nabcd', fontSize: 20, bold: true });
    expect(plain.height).toBeCloseTo(2 * 1.25 * 20);
    expect(plain.width).toBeCloseTo(4 * 0.62 * 20);
    expect(bold.width).toBeGreaterThan(plain.width);
  });

  it('hits only inside the text box, measured on screen so zoom does not change it', () => {
    const note = { id: 'n', text: 'Hello', at: { x: 100, y: 50 }, fontSize: 20 };
    const zoom = 0.5;
    const halfLine = (20 * 1.25) / 2 / zoom;
    expect(noteHit(note, { x: 110, y: 50 }, zoom)).toBe(true);
    expect(noteHit(note, { x: 90, y: 50 }, zoom)).toBe(false);
    expect(noteHit(note, { x: 110, y: 50 + halfLine - 1 }, zoom)).toBe(true);
    expect(noteHit(note, { x: 110, y: 50 + halfLine + 1 }, zoom)).toBe(false);
    expect(noteHit(note, { x: 110, y: 50 - halfLine - 1 }, zoom)).toBe(false);
    expect(noteHit(note, { x: 100 + 5000, y: 50 }, zoom)).toBe(false);
  });
});

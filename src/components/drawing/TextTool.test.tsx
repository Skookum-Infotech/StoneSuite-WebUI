// @vitest-environment jsdom
// The Text tool end to end: arm it, click the board, the text appears there
// and a control bar opens at the bottom centre — words, Bold, Italic, size,
// Delete.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, Note } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { TextControls } from './TextControls';
import { ToolRail } from './ToolRail';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, cabinets: [], notes: [], pieces: [] }],
  updatedAt: '', updatedBy: { id: 'u1', name: 'T' },
};

function Readout() {
  const { state, tool } = useDrawingEditor();
  return (
    <>
      <span data-testid="notes">{JSON.stringify(state.present.areas[0].notes)}</span>
      <span data-testid="history">{state.past.length}</span>
      <span data-testid="tool">{tool}</span>
    </>
  );
}

const notes = (): Note[] => JSON.parse(screen.getByTestId('notes').textContent ?? '[]');
const history = () => Number(screen.getByTestId('history').textContent);

function open() {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
  } as DOMRect);
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <ToolRail />
      <DrawingCanvas />
      <TextControls />
      <Readout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

/** Arms the Text tool and clicks world (100, 50). */
async function placeText(user: ReturnType<typeof userEvent.setup>, clientX = 500, clientY = 250) {
  await user.click(screen.getByRole('button', { name: 'Text' }));
  const at = { pointerId: 1, button: 0, clientX, clientY };
  fireEvent.pointerDown(screen.getByTestId('tool-capture'), at);
  // A real click also releases; with the tool handed back to Select the sheet
  // is gone by then, so the release lands on the board underneath.
  fireEvent.pointerUp(screen.getByTestId('canvas-background'), at);
}

const bar = () => screen.queryByRole('toolbar', { name: 'Text controls' });

afterEach(() => vi.restoreAllMocks());

describe('Text tool — placing', () => {
  it('drops text where the board was clicked, opens the control bar on it and hands back to Select', async () => {
    const user = open();
    expect(bar()).toBeNull();
    await placeText(user);
    expect(notes()).toEqual([expect.objectContaining({ text: 'Text', at: { x: 100, y: 50 } })]);
    expect(screen.getByTestId('tool').textContent).toBe('select');
    expect(bar()).not.toBeNull();
    const field = screen.getByLabelText('Text content') as HTMLTextAreaElement;
    expect(field.value).toBe('Text');
    // Focus lands a tick later — after the click that placed the text has
    // finished moving focus around.
    await vi.waitFor(() => expect(document.activeElement).toBe(field));
    expect(screen.getByRole('button', { name: 'Text: Text' })).toBeDefined();
  });

  it('shows what is typed on the board, line by line', async () => {
    const user = open();
    await placeText(user);
    const field = screen.getByLabelText('Text content');
    await user.clear(field);
    await user.type(field, 'Seam here{Enter}and here');
    expect(notes()[0].text).toBe('Seam here\nand here');
    const spans = Array.from(document.querySelectorAll('tspan')).map((t) => t.textContent);
    expect(spans).toEqual(['Seam here', 'and here']);
  });

  it('folds a whole run of typing into one undo step', async () => {
    const user = open();
    await placeText(user);
    const placed = history();
    await user.clear(screen.getByLabelText('Text content'));
    await user.type(screen.getByLabelText('Text content'), 'abcdef');
    expect(history()).toBe(placed + 1);
  });
});

describe('Text tool — controls', () => {
  it('toggles Bold and Italic, on the note and on the board', async () => {
    const user = open();
    await placeText(user);
    const boldButton = screen.getByRole('button', { name: 'Bold' });
    const italicButton = screen.getByRole('button', { name: 'Italic' });
    expect(boldButton.getAttribute('aria-pressed')).toBe('false');
    await user.click(boldButton);
    await user.click(italicButton);
    expect(notes()[0]).toEqual(expect.objectContaining({ bold: true, italic: true }));
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');
    const text = document.querySelector('text.select-none');
    expect(text?.getAttribute('class')).toContain('font-bold');
    expect(text?.getAttribute('class')).toContain('italic');
    await user.click(boldButton);
    expect(notes()[0].bold).toBe(false);
  });

  it('changes the size with − and +, and by typing a number, within limits', async () => {
    const user = open();
    await placeText(user);
    const size = screen.getByLabelText('Text size') as HTMLInputElement;
    expect(size.value).toBe('18');
    await user.click(screen.getByRole('button', { name: 'Larger text' }));
    expect(notes()[0].fontSize).toBe(20);
    await user.click(screen.getByRole('button', { name: 'Smaller text' }));
    await user.click(screen.getByRole('button', { name: 'Smaller text' }));
    expect(notes()[0].fontSize).toBe(16);
    await user.clear(size);
    await user.type(size, '36{Enter}');
    expect(notes()[0].fontSize).toBe(36);
    expect(size.value).toBe('36');
    await user.clear(size);
    await user.type(size, '500{Enter}');
    expect(notes()[0].fontSize).toBe(96);
    expect(size.value).toBe('96');
    expect((screen.getByRole('button', { name: 'Larger text' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Delete removes the text and closes the bar', async () => {
    const user = open();
    await placeText(user);
    await user.click(screen.getByRole('button', { name: 'Delete text' }));
    expect(notes()).toEqual([]);
    expect(bar()).toBeNull();
  });

  it('Done closes the bar and keeps the text; text emptied first is dropped instead of left invisible', async () => {
    const user = open();
    await placeText(user);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(bar()).toBeNull();
    expect(notes()).toHaveLength(1);

    await placeText(user, 300, 400); // a second one, elsewhere
    expect(notes()).toHaveLength(2);
    await user.clear(screen.getByLabelText('Text content'));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(notes()).toHaveLength(1);
  });

  it('Escape in the box lets go of the text', async () => {
    const user = open();
    await placeText(user);
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Text content')));
    await user.keyboard('{Escape}');
    expect(bar()).toBeNull();
    expect(notes()).toHaveLength(1);
  });
});

describe('Text tool — where it lands', () => {
  it('centres the first line vertically on the click and starts at its left', async () => {
    const user = open();
    await placeText(user);
    const text = document.querySelector('text.select-none');
    expect(text?.getAttribute('x')).toBe('100');
    expect(text?.getAttribute('y')).toBe('-50');
    expect(text?.getAttribute('dominant-baseline')).toBe('central');
  });

  it('typing right after placing reaches the box without clicking it first', async () => {
    const user = open();
    await placeText(user);
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Text content')));
    await user.keyboard('Hello');
    // The placeholder was selected, so typing replaces it.
    expect(notes()[0].text).toBe('Hello');
  });
});

describe('Text tool — with a piece already selected', () => {
  const withPiece: Drawing = {
    ...drawing,
    areas: [{
      ...drawing.areas[0],
      pieces: [{
        id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(600, 400), position: { x: -2000, y: 0 },
        rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
      }],
    }],
  };

  function SelectPiece() {
    const { dispatch } = useDrawingEditor();
    return <button type="button" onClick={() => dispatch({ type: 'selectPiece', pieceId: 'p1' })}>select piece</button>;
  }

  function openWithPiece() {
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => undefined,
    } as DOMRect);
    render(
      <DrawingEditorProvider drawing={withPiece} materialLines={[]}>
        <ToolRail />
        <DrawingCanvas />
        <TextControls />
        <SelectPiece />
        <Readout />
      </DrawingEditorProvider>,
    );
    return userEvent.setup();
  }

  it('opens the control bar on newly placed text even though a piece was selected', async () => {
    const user = openWithPiece();
    await user.click(screen.getByRole('button', { name: 'select piece' }));
    await placeText(user);
    expect(notes()).toHaveLength(1);
    expect(bar()).not.toBeNull();
  });

  it('opens the control bar when a press picks existing text while a piece is selected', async () => {
    const user = openWithPiece();
    await placeText(user);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'select piece' }));
    expect(bar()).toBeNull();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Text: Text' }));
    expect(bar()).not.toBeNull();
  });
});

describe('Text tool — picking text again', () => {
  it('a press on text already on the board picks it up instead of adding another', async () => {
    const user = open();
    await placeText(user);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Text' }));
    // Inside the existing text's box (it starts at world (100, 50)).
    fireEvent.pointerDown(screen.getByTestId('tool-capture'), { clientX: 510, clientY: 245 });
    expect(notes()).toHaveLength(1);
    expect(bar()).not.toBeNull();
  });

  it('with Select, clicking the text on the board opens the bar; clicking empty board closes it', async () => {
    const user = open();
    await placeText(user);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(bar()).toBeNull();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Text: Text' }));
    expect(bar()).not.toBeNull();
    const empty = { pointerId: 1, button: 0, clientX: 100, clientY: 500 };
    fireEvent.pointerDown(screen.getByTestId('canvas-background'), empty);
    fireEvent.pointerUp(screen.getByTestId('canvas-background'), empty);
    expect(bar()).toBeNull();
  });

  it('switching to another tool puts the bar away', async () => {
    const user = open();
    await placeText(user);
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(bar()).toBeNull();
  });
});

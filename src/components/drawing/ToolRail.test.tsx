// @vitest-environment jsdom
// The rail down the left of the board: only the pointer, Draw and Text.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { ToolRail } from './ToolRail';

const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

function Readout() {
  const { tool } = useDrawingEditor();
  return <span data-testid="tool">{tool}</span>;
}

function open() {
  render(
    <DrawingEditorProvider drawing={drawing} materialLines={[]}>
      <ToolRail />
      <Readout />
    </DrawingEditorProvider>,
  );
  return userEvent.setup();
}

const tool = () => screen.getByTestId('tool').textContent;

afterEach(() => vi.restoreAllMocks());

describe('ToolRail', () => {
  it('holds only the pointer, Draw and Text — no Line and no flyout sections', () => {
    open();
    const rail = screen.getByRole('navigation', { name: 'Drawing tools' });
    expect(within(rail).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Select', 'Draw', 'Text']);
    for (const gone of ['Line', 'Shapes', 'Cutouts', 'Annotations', 'Materials']) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
  });

  it('starts on Select', () => {
    open();
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('true');
    expect(tool()).toBe('select');
  });

  it('arms Draw and Text, and lights only the armed tool', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(tool()).toBe('draw');
    expect(screen.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect(tool()).toBe('text');
    expect(screen.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('pressing an armed tool again, or Select, hands back to Select', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Text' }));
    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect(tool()).toBe('select');
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(tool()).toBe('select');
  });
});

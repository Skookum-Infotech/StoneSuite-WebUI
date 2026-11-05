// @vitest-environment jsdom
// The icon rail's own flyout behaviour: one section open at a time, closes
// on Escape or an outside click, and Select exits whatever tool is active.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { ToolRail } from './ToolRail';

vi.mock('@/services/drawingService', () => ({
  drawingService: { getEdgeCodes: vi.fn().mockResolvedValue([]) },
}));

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

afterEach(() => vi.restoreAllMocks());

describe('ToolRail', () => {
  it('opens one section at a time: a second icon replaces the first flyout', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(screen.getByRole('region', { name: 'Shapes' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cutouts' }));
    expect(screen.queryByRole('region', { name: 'Shapes' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Cutouts' })).toBeTruthy();
  });

  it('clicking the open section again closes it', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    expect(screen.queryByRole('region', { name: 'Shapes' })).toBeNull();
  });

  it('closes on Escape', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Annotations' }));
    expect(screen.getByRole('region', { name: 'Annotations' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Annotations' })).toBeNull();
  });

  it('closes on a click outside the rail', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region', { name: 'Shapes' })).toBeNull();
  });

  it('closes via its own Close button', async () => {
    const user = open();
    await user.click(screen.getByRole('button', { name: 'Shapes' }));
    await user.click(screen.getByRole('button', { name: 'Close Shapes' }));
    expect(screen.queryByRole('region', { name: 'Shapes' })).toBeNull();
  });

  it('Select is pressed by default and switches the tool back from Annotations', async () => {
    const user = open();
    expect(screen.getByRole('button', { name: 'Select' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Annotations' }));
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(screen.getByTestId('tool').textContent).toBe('note');
    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByTestId('tool').textContent).toBe('select');
    expect(screen.queryByRole('region', { name: 'Annotations' })).toBeNull();
  });
});

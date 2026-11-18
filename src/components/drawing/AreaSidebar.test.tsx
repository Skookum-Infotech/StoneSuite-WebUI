import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { AreaSidebar } from './AreaSidebar';

function drawing(areaCount: number): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: Array.from({ length: areaCount }, (_, i) => ({
      id: `area-${i}`, name: `Area ${i}`, code: '', sortOrder: i, pieces: [], cabinets: [], notes: [],
    })),
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

function ActiveAreaReadout() {
  const { state } = useDrawingEditor();
  return <span data-testid="active-area">{state.activeAreaId}</span>;
}

function HistoryReadout() {
  const { state } = useDrawingEditor();
  return <span data-testid="past-length">{state.past.length}</span>;
}

function renderSidebar(areaCount: number, onClose = vi.fn()) {
  render(
    <DrawingEditorProvider drawing={drawing(areaCount)} materialLines={[]}>
      <AreaSidebar onClose={onClose} />
      <ActiveAreaReadout />
      <HistoryReadout />
    </DrawingEditorProvider>,
  );
  return onClose;
}

const rows = () => screen.getAllByRole('listitem');

describe('AreaSidebar', () => {
  it('lists one row per area, marking the active one', () => {
    renderSidebar(2);
    expect(rows()).toHaveLength(2);
    expect(within(rows()[0]).getByRole('button', { name: 'Area 0' })).toHaveAttribute('aria-current', 'true');
    expect(within(rows()[1]).getByRole('button', { name: 'Area 1' })).not.toHaveAttribute('aria-current');
  });

  it('clicking an area makes it active', async () => {
    renderSidebar(2);
    await userEvent.click(within(rows()[1]).getByRole('button', { name: 'Area 1' }));
    expect(screen.getByTestId('active-area').textContent).toBe('area-1');
  });

  it('"+ Area" adds a new area with the next free number as its name', async () => {
    renderSidebar(1);
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(rows()).toHaveLength(2);
    expect(within(rows()[1]).getByRole('button', { name: 'Area 2' })).toBeDefined();
  });

  it('can add several areas in a row', async () => {
    renderSidebar(1);
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(rows()).toHaveLength(4);
  });

  it('reorder buttons swap an area with its neighbour, and are disabled at the ends', async () => {
    renderSidebar(3);
    const moveDown = screen.getAllByRole('button', { name: /Move .* down/ });
    const moveUp = screen.getAllByRole('button', { name: /Move .* up/ });
    expect(moveUp[0]).toBeDisabled(); // the first area can't move up
    expect(moveDown[2]).toBeDisabled(); // the last area can't move down

    await userEvent.click(moveDown[0]); // Area 0 swaps with Area 1
    expect(rows()[0]).toHaveTextContent('Area 1');
    expect(rows()[1]).toHaveTextContent('Area 0');
  });

  it('delete is disabled with an explanatory label when only one area remains', () => {
    renderSidebar(1);
    const deleteButton = screen.getByRole('button', { name: /Delete/ });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAccessibleName(expect.stringContaining('only area'));
  });

  it('delete opens a confirm dialog, and confirming removes the area', async () => {
    renderSidebar(2);
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete Area/ })[0]);
    expect(screen.getByRole('dialog')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Delete area' }));
    expect(rows()).toHaveLength(1);
  });

  it('commits the area code on blur, not on every keystroke — typing a 7-letter code uses one history entry, not seven', async () => {
    renderSidebar(1);
    const codeInput = screen.getByLabelText('Area 0 code');
    await userEvent.type(codeInput, 'Kitchen');
    expect(screen.getByTestId('past-length').textContent).toBe('0');
    await userEvent.tab();
    expect(screen.getByTestId('past-length').textContent).toBe('1');
    expect(codeInput).toHaveValue('Kitchen');
  });

  it('renaming swaps the name for a text input, and Enter saves it', async () => {
    renderSidebar(1);
    await userEvent.click(screen.getByRole('button', { name: 'Rename Area 0' }));
    const input = screen.getByLabelText('Rename Area 0');
    await userEvent.clear(input);
    await userEvent.type(input, 'Kitchen');
    await userEvent.keyboard('{Enter}');
    expect(rows()[0]).toHaveTextContent('Kitchen');
  });

  it('confirming area delete moves focus to "Add area" instead of stranding it on the removed delete button', async () => {
    renderSidebar(2);
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete Area/ })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Delete area' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add area' }));
  });

  it('the ✕ and Escape both close it', async () => {
    const onClose = renderSidebar(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close areas' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Add area' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

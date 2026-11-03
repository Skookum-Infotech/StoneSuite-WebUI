import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { AreaTabs } from './AreaTabs';

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

function renderTabs(areaCount: number) {
  render(
    <DrawingEditorProvider drawing={drawing(areaCount)} materialLines={[]}>
      <AreaTabs />
      <ActiveAreaReadout />
    </DrawingEditorProvider>,
  );
}

describe('AreaTabs', () => {
  it('renders one tab per area, aria-selected matching the active area', () => {
    renderTabs(2);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking a tab makes it active', async () => {
    renderTabs(2);
    await userEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByTestId('active-area').textContent).toBe('area-1');
  });

  it('"+" adds a new area', async () => {
    renderTabs(1);
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('reorder buttons swap a tab with its neighbor, and are disabled at the ends', async () => {
    renderTabs(3);
    const moveRightButtons = screen.getAllByRole('button', { name: /Move .* right/ });
    const moveLeftButtons = screen.getAllByRole('button', { name: /Move .* left/ });
    expect(moveLeftButtons[0]).toBeDisabled(); // first tab can't move left
    expect(moveRightButtons[2]).toBeDisabled(); // last tab can't move right

    await userEvent.click(moveRightButtons[0]); // Area 0 swaps with Area 1
    const tabsAfter = screen.getAllByRole('tab');
    expect(tabsAfter[0]).toHaveTextContent('Area 1');
    expect(tabsAfter[1]).toHaveTextContent('Area 0');
  });

  it('delete is disabled with an explanatory label when only one area remains', () => {
    renderTabs(1);
    const deleteButton = screen.getByRole('button', { name: /Delete/ });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAccessibleName(expect.stringContaining('only area'));
  });

  it('delete opens a confirm dialog, and confirming removes the area', async () => {
    renderTabs(2);
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete Area/ });
    await userEvent.click(deleteButtons[0]);
    expect(screen.getByRole('dialog')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Delete area' }));
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});

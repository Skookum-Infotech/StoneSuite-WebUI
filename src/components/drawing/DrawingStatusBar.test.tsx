// @vitest-environment jsdom
// The bottom bar: active area + Areas sidebar, square footage, zoom, map switch.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/types/drawing';
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/drawing/constants';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { DrawingStatusBar } from './DrawingStatusBar';

function drawing(): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'in', fractionDenominator: 32,
    areas: [
      {
        id: 'a1', name: 'Kitchen', code: '', sortOrder: 0, cabinets: [], notes: [],
        // 600 x 400 mm = 240,000 mm² = 2.583 sq ft.
        pieces: [{
          id: 'p1', label: 'A-1', shape: 'rect',
          outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
          position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
        }],
      },
      { id: 'a2', name: 'Bath', code: '', sortOrder: 1, pieces: [], cabinets: [], notes: [] },
    ],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  };
}

function Readout() {
  const { state } = useDrawingEditor();
  return <span data-testid="zoom">{state.zoom}</span>;
}

function open() {
  render(
    <DrawingEditorProvider drawing={drawing()} materialLines={[]}>
      <DrawingStatusBar />
      <Readout />
    </DrawingEditorProvider>,
  );
}

describe('DrawingStatusBar — area', () => {
  it('shows the active area and its square footage to three decimals', () => {
    open();
    expect(screen.getByRole('button', { name: /^Areas, Kitchen selected/ })).toBeDefined();
    expect(screen.getByText(/2\.583 sq ft/)).toBeDefined();
  });

  it('the square footage follows the active area', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: /^Areas/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Bath' }));
    expect(screen.getByText(/0\.000 sq ft/)).toBeDefined();
    expect(screen.getByRole('button', { name: /^Areas, Bath selected/ })).toBeDefined();
  });

  it('clicking the area opens the Areas sidebar where more can be added, and clicking again closes it', async () => {
    open();
    expect(screen.queryByRole('complementary', { name: 'Areas' })).toBeNull();
    const toggle = screen.getByRole('button', { name: /^Areas/ });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('complementary', { name: 'Areas' })).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Add area' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(toggle);
    expect(screen.queryByRole('complementary', { name: 'Areas' })).toBeNull();
  });

  it('the ⓘ button shows the piece count and totals', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Area details' }));
    expect(screen.getByText('1 pieces')).toBeDefined();
  });
});

describe('DrawingStatusBar — zoom', () => {
  it('shows the zoom as a percentage', () => {
    open();
    expect(screen.getByLabelText('Zoom level')).toHaveTextContent('100%');
  });

  it('+ and − step the zoom', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByLabelText('Zoom level')).toHaveTextContent('125%');
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByLabelText('Zoom level')).toHaveTextContent('70%');
  });

  it('stops at the zoom limits, with the button disabled', async () => {
    open();
    for (let i = 0; i < 20; i++) {
      const out = screen.getByRole('button', { name: 'Zoom out' });
      if ((out as HTMLButtonElement).disabled) break;
      await userEvent.click(out);
    }
    expect(Number(screen.getByTestId('zoom').textContent)).toBe(ZOOM_MIN);
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    for (let i = 0; i < 40; i++) {
      const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
      if ((zoomIn as HTMLButtonElement).disabled) break;
      await userEvent.click(zoomIn);
    }
    expect(Number(screen.getByTestId('zoom').textContent)).toBe(ZOOM_MAX);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  });
});

describe('DrawingStatusBar — map', () => {
  it('the Map button flips the map on and off', async () => {
    open();
    const toggle = screen.getByRole('button', { name: 'Map' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DrawingStatusBar — dimensions', () => {
  it('starts off, and the Dimensions button flips it on and off', async () => {
    open();
    const toggle = screen.getByRole('button', { name: 'Dimensions' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

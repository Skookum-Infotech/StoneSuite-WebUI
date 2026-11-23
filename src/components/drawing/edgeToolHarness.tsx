// Shared setup for the Edges tool tests: a drawing with one piece, the four edge
// types every shop starts with, a mocked server that reads and writes them, and
// the helpers that arm the tool and pick a type. The test file mocks
// '@/services/drawingService'; this only drives the mocked calls.

// A test harness, not a Fast Refresh module: it exports helpers beside its render function.
/* eslint-disable react-refresh/only-export-components */

import { expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing, EdgeType, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { drawingService } from '@/services/drawingService';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { EdgeModeBar } from './EdgeModeBar';
import { EdgeTypesProvider } from './EdgeTypesContext';
import { ToolRail } from './ToolRail';

export const SEEDED: EdgeType[] = [
  { id: 'e1', name: 'Ease', pricingType: 'linear', price: 0, alias: 'E', color: '#2563eb', finish: 'eased', isSystem: true },
  { id: 'e2', name: 'Appliance', pricingType: 'linear', price: 10, alias: 'A', color: '#15803d', finish: 'halfBullnose', isSystem: true },
  { id: 'e3', name: 'Finished', pricingType: 'linear', price: 0, alias: 'F', color: '#d97706', finish: 'none', isSystem: true },
  { id: 'e4', name: 'Unfinished', pricingType: 'linear', price: 0, alias: 'U', color: '#6b7280', finish: 'raw', isSystem: true },
];

const piece: Piece = {
  id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(2000, 800), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [],
};
const drawing: Drawing = {
  schemaVersion: 1, salesOrderId: 's', version: 0, displayUnit: 'mm', fractionDenominator: 32,
  areas: [{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [piece], cabinets: [], notes: [] }],
  updatedAt: '', updatedBy: { id: 'u', name: 'U' },
};

/** The server's list, which the mocked service reads and writes. */
let server: EdgeType[];

/** Gives each test a fresh server list, and mocks the service to read and write it. */

function Readout() {
  const { state, tool, dispatch } = useDrawingEditor();
  return (
    <>
      <span data-testid="tool">{tool}</span>
      <span data-testid="edges">{JSON.stringify(state.present.areas[0].pieces[0].edges)}</span>
      <button type="button" onClick={() => dispatch({ type: 'undo' })}>undo</button>
    </>
  );
}

export function open() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DrawingEditorProvider drawing={drawing} materialLines={[]}>
        <EdgeTypesProvider>
          <ToolRail />
          <div className="relative">
            <DrawingCanvas />
            <EdgeModeBar />
          </div>
          <Readout />
        </EdgeTypesProvider>
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

export const edges = () => JSON.parse(screen.getByTestId('edges').textContent ?? '[]');
export const tool = () => screen.getByTestId('tool').textContent;
export const picker = () => screen.getByRole('combobox', { name: 'Edge type' });

export async function arm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edges' }));
  await waitFor(() => expect(picker().textContent).toContain('Ease'));
}

export async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(picker());
  await user.click(await screen.findByRole('option', { name }));
}

/** Replaces the server's list (an empty shop, say) for the rest of the test. */
export function setServerTypes(types: EdgeType[]) {
  server = types;
}

export function resetEdgeServer() {
  server = SEEDED.map((t) => ({ ...t }));
  vi.mocked(drawingService.getEdgeTypes).mockReset().mockImplementation(() => Promise.resolve(server.map((t) => ({ ...t }))));
  vi.mocked(drawingService.createEdgeType).mockReset().mockImplementation((input) => {
    const saved: EdgeType = { ...input, id: 'new1', isSystem: false };
    server = [...server, saved];
    return Promise.resolve(saved);
  });
  vi.mocked(drawingService.updateEdgeType).mockReset().mockImplementation((id, input) => {
    const saved: EdgeType = { ...input, id, isSystem: true };
    server = server.map((t) => (t.id === id ? saved : t));
    return Promise.resolve(saved);
  });
}

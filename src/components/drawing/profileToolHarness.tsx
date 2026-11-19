// Shared setup for the Profiles tool tests: a drawing with one piece, the
// four attached-profile types every shop starts with, a mocked server that
// reads and writes them, and the helpers that arm the tool and pick a type.
// The test file mocks '@/services/drawingService'; this only drives the
// mocked calls. Mirrors edgeToolHarness.tsx.

// A test harness, not a Fast Refresh module: it exports helpers beside its render function.
/* eslint-disable react-refresh/only-export-components */

import { expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AttachedProfileType, Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { drawingService } from '@/services/drawingService';
import { AttachedProfileTypesProvider } from './AttachedProfileTypesContext';
import { DrawingCanvas } from './DrawingCanvas';
import { DrawingEditorProvider, useDrawingEditor } from './DrawingEditorContext';
import { ProfileModeBar } from './ProfileModeBar';
import { ToolRail } from './ToolRail';

export const SEEDED: AttachedProfileType[] = [
  { id: 'p1', name: 'Backsplash', pricingType: 'linear', price: 12, alias: 'BS', color: '#2563eb', measurementPresetsMm: [101.6, 152.4], angle: 90, finish: 'none', isSystem: true },
  { id: 'p2', name: 'Lamination', pricingType: 'linear', price: 18, alias: 'LM', color: '#9333ea', measurementPresetsMm: [38.1, 50.8], angle: 180, finish: 'mitered', isSystem: true },
  { id: 'p3', name: 'Miter Edge', pricingType: 'linear', price: 15, alias: 'ME', color: '#f59e0b', measurementPresetsMm: [38.1], angle: 90, finish: 'mitered', isSystem: true },
  { id: 'p4', name: 'Waterfall', pricingType: 'linear', price: 22, alias: 'WF', color: '#ec4899', measurementPresetsMm: [609.6, 762], angle: 270, finish: 'mitered', isSystem: true },
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
let server: AttachedProfileType[];

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
        <AttachedProfileTypesProvider>
          <ToolRail />
          <div className="relative">
            <DrawingCanvas />
            <ProfileModeBar />
          </div>
          <Readout />
        </AttachedProfileTypesProvider>
      </DrawingEditorProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

export const edges = () => JSON.parse(screen.getByTestId('edges').textContent ?? '[]');
export const tool = () => screen.getByTestId('tool').textContent;
export const picker = () => screen.getByRole('combobox', { name: 'Profile type' });
export const measurementSelect = () => screen.getByRole('combobox', { name: 'Profile measurement' });

export async function arm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Profiles' }));
  await waitFor(() => expect(picker().textContent).toContain('Backsplash'));
}

export async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(picker());
  await user.click(await screen.findByRole('option', { name }));
}

/** Replaces the server's list (an empty shop, say) for the rest of the test. */
export function setServerTypes(types: AttachedProfileType[]) {
  server = types;
}

export function resetProfileServer() {
  server = SEEDED.map((t) => ({ ...t }));
  vi.mocked(drawingService.getAttachedProfileTypes).mockReset().mockImplementation(() => Promise.resolve(server.map((t) => ({ ...t }))));
  vi.mocked(drawingService.createAttachedProfileType).mockReset().mockImplementation((input) => {
    const saved: AttachedProfileType = { ...input, id: 'new1', isSystem: false };
    server = [...server, saved];
    return Promise.resolve(saved);
  });
  vi.mocked(drawingService.updateAttachedProfileType).mockReset().mockImplementation((id, input) => {
    const saved: AttachedProfileType = { ...input, id, isSystem: true };
    server = server.map((t) => (t.id === id ? saved : t));
    return Promise.resolve(saved);
  });
}

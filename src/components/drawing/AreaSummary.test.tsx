import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Drawing, Piece } from '@/types/drawing';
import { rectOutline } from '@/lib/drawing/geometry';
import { DrawingEditorProvider } from './DrawingEditorContext';
import { AreaSummary } from './AreaSummary';

vi.mock('@/services/companyProfileService', () => ({
  companyProfileService: { get: vi.fn() },
}));

import { companyProfileService } from '@/services/companyProfileService';

const FT_TO_MM = 304.8;

function makePiece(id: string, label: string, lengthFt: number, widthFt: number): Piece {
  return {
    id,
    label,
    shape: 'rect',
    outline: rectOutline(lengthFt * FT_TO_MM, widthFt * FT_TO_MM),
    position: { x: 0, y: 0 },
    rotationDeg: 0,
    thicknessMm: 30,
    edges: [],
    seams: [],
    cutouts: [],
  };
}

function drawing(): Drawing {
  return {
    schemaVersion: 1,
    salesOrderId: 'so1',
    version: 0,
    displayUnit: 'in',
    fractionDenominator: 32,
    areas: [
      {
        id: 'area-1',
        name: 'Kitchen',
        code: '',
        sortOrder: 0,
        cabinets: [],
        notes: [],
        pieces: [makePiece('p1', 'A-1', 10, 2), makePiece('p2', 'A-2', 5, 2)],
      },
      { id: 'area-2', name: 'Island', code: '', sortOrder: 1, pieces: [], cabinets: [], notes: [] },
    ],
    updatedAt: '2026-11-03T00:00:00.000Z',
    updatedBy: { id: 'u1', name: 'Test User' },
  };
}

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <DrawingEditorProvider drawing={drawing()} materialLines={[]}>
        {children}
      </DrawingEditorProvider>
    </QueryClientProvider>
  );
  return render(<AreaSummary />, { wrapper });
}

describe('AreaSummary', () => {
  it('shows the total, each area and each piece with countertop and fabrication sq ft at 20%', async () => {
    vi.mocked(companyProfileService.get).mockResolvedValue({
      companyName: 'Acme', legalName: '', industry: '', website: '', country: '', currency: '', timezone: '', taxId: '',
      fabricationPercent: 20,
      billingAddress: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
      shippingAddress: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
      returnAddress: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
      logoUrl: '',
    });
    renderSummary();

    expect(await screen.findByText('Total Project Measurements (sq ft)')).toBeInTheDocument();
    // Total: 30 sq ft countertop, 36.000 fabrication at 20% (Kitchen's two
    // pieces are 20 + 10 sq ft; Island has none).
    const totalRow = screen.getByText('Total Project').closest('div') as HTMLElement;
    expect(within(totalRow).getByText('30.000')).toBeInTheDocument();
    expect(within(totalRow).getByText('36.000')).toBeInTheDocument();

    const kitchenRow = screen.getByText('Area: Kitchen').closest('div') as HTMLElement;
    expect(within(kitchenRow).getByText('30.000')).toBeInTheDocument();
    expect(within(kitchenRow).getByText('36.000')).toBeInTheDocument();
    expect(screen.getByText('Area: Island')).toBeInTheDocument();

    const pieceA1Row = screen.getByText('Piece: A-1').closest('div') as HTMLElement;
    expect(within(pieceA1Row).getByText('20.000')).toBeInTheDocument();
    expect(within(pieceA1Row).getByText('24.000')).toBeInTheDocument();
    expect(screen.getByText('Piece: A-2')).toBeInTheDocument();
  });

  it('falls back to the 20% default while the company profile is still loading', () => {
    vi.mocked(companyProfileService.get).mockReturnValue(new Promise(() => {}));
    renderSummary();

    expect(screen.getByText('Total Project Measurements (sq ft)')).toBeInTheDocument();
    const totalRow = screen.getByText('Total Project').closest('div') as HTMLElement;
    expect(within(totalRow).getByText('36.000')).toBeInTheDocument();
  });
});

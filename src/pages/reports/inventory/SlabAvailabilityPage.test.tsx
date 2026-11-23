import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { SlabReport } from '@/types/reports';

vi.mock('@/services/reportsService', () => ({ reportsService: { slabAvailability: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../components/ReportCountBarChart', () => ({ ReportCountBarChart: () => null }));

import SlabAvailabilityPage from './SlabAvailabilityPage';
import { reportsService } from '@/services/reportsService';

const REPORT: SlabReport = {
  labels: ['Available', 'Reserved', 'Received (no bin)', 'On order', 'In transit'],
  totals: { counts: [10, 4, 1, 0, 0], areas: [259.445, 86.062, 8.333, 0, 0], totalSlabs: 15 },
  rows: [
    { itemId: 'i1', sku: '444', name: 'Granite', unit: 'SQFT', counts: [10, 0, 1, 0, 0], areas: [259.445, 0, 8.333, 0, 0], totalSlabs: 11, totalArea: 267.778 },
  ],
};

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SlabAvailabilityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SlabAvailabilityPage', () => {
  it('shows one column per slab status with count and area', async () => {
    vi.mocked(reportsService.slabAvailability).mockResolvedValue(REPORT);
    renderPage();
    const table = await screen.findByRole('table', { name: 'Slab availability' });
    for (const label of REPORT.labels) expect(table).toHaveTextContent(label);
    expect(table).toHaveTextContent('10 slabs · 259.45 SQFT');
    expect(table).toHaveTextContent('1 slab · 8.33 SQFT');
  });

  it('summarises every status plus the grand total', async () => {
    vi.mocked(reportsService.slabAvailability).mockResolvedValue(REPORT);
    renderPage();
    await screen.findByRole('table', { name: 'Slab availability' });
    const kpis = screen.getByLabelText('Report totals');
    expect(kpis).toHaveTextContent('Available10');
    expect(kpis).toHaveTextContent('All live slabs15');
  });

  it('says so when no slabs are live', async () => {
    vi.mocked(reportsService.slabAvailability).mockResolvedValue({ ...REPORT, rows: [], totals: { counts: [0, 0, 0, 0, 0], areas: [0, 0, 0, 0, 0], totalSlabs: 0 } });
    renderPage();
    expect(await screen.findByText('No live slabs.')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/fabricationService', () => ({
  fabricationService: { getJobSlabs: vi.fn(), recordDisposition: vi.fn(), requestCancel: vi.fn() },
}));
vi.mock('@/services/inventoryBinService', () => ({ inventoryBinService: { getTree: vi.fn() } }));

import { CancelFabricationJobDialog } from './CancelFabricationJobDialog';
import { fabricationService } from '@/services/fabricationService';
import { inventoryBinService } from '@/services/inventoryBinService';
import type { FabricationSlab } from '@/types/fabrication';
import type { Bin } from '@/types/inventory';

const slab: FabricationSlab = {
  id: 'slab-1', serial: 'SL-100', vendorId: null, inventoryItemId: 'item-1', warehouseId: 1,
  lengthMm: 3000, widthMm: 1500, thicknessMm: 20, area: 4.5, form: 'full', status: 'consumed',
};

const bin = { id: 'bin-1', name: 'Offcut Rack', warehouseName: 'Main Yard', depth: 1, unitCount: 0, overCapacity: false } as Bin;

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CancelFabricationJobDialog
        job={{ id: 'job-1', statusCode: 'CUTG', cancelRequested: true }}
        onCancelled={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

async function openAndChooseRecovered(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Cancel fabrication job' }));
  await user.selectOptions(await screen.findByLabelText('Disposition for slab SL-100'), 'recovered');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fabricationService.getJobSlabs).mockResolvedValue([slab]);
  vi.mocked(fabricationService.recordDisposition).mockResolvedValue(undefined);
  vi.mocked(inventoryBinService.getTree).mockResolvedValue([bin]);
});

describe('CancelFabricationJobDialog — recovered offcuts', () => {
  it('will not record a recovered offcut without its dimensions', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openAndChooseRecovered(user);

    await user.type(screen.getByLabelText('Recovered area for slab SL-100'), '1.5');
    await user.click(screen.getByRole('button', { name: 'Record disposition for slab SL-100' }));

    expect(await screen.findByText(/length, width and thickness/i)).toBeInTheDocument();
    expect(fabricationService.recordDisposition).not.toHaveBeenCalled();
  });

  it('will not record a recovered offcut without a put-away bin', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openAndChooseRecovered(user);

    await user.type(screen.getByLabelText('Recovered area for slab SL-100'), '1.5');
    await user.type(screen.getByLabelText('Length of the offcut from slab SL-100'), '1000');
    await user.type(screen.getByLabelText('Width of the offcut from slab SL-100'), '500');
    await user.type(screen.getByLabelText('Thickness of the offcut from slab SL-100'), '20');
    await user.click(screen.getByRole('button', { name: 'Record disposition for slab SL-100' }));

    expect(await screen.findByText('Choose the bin the offcut is put away in.')).toBeInTheDocument();
    expect(fabricationService.recordDisposition).not.toHaveBeenCalled();
  });

  it('sends the dimensions and destination bin once the offcut is fully described', async () => {
    const user = userEvent.setup();
    renderDialog();
    await openAndChooseRecovered(user);

    await user.type(screen.getByLabelText('Recovered area for slab SL-100'), '1.5');
    await user.type(screen.getByLabelText('Length of the offcut from slab SL-100'), '1000');
    await user.type(screen.getByLabelText('Width of the offcut from slab SL-100'), '500');
    await user.type(screen.getByLabelText('Thickness of the offcut from slab SL-100'), '20');
    await user.selectOptions(
      await screen.findByLabelText('Put-away bin for the offcut from slab SL-100'), 'bin-1',
    );
    await user.click(screen.getByRole('button', { name: 'Record disposition for slab SL-100' }));

    expect(fabricationService.recordDisposition).toHaveBeenCalledWith('job-1', 'slab-1', {
      disposition: 'recovered', recoveredArea: 1.5,
      lengthMm: 1000, widthMm: 500, thicknessMm: 20, destinationBinUuid: 'bin-1',
    });
  });

  it('does not ask for dimensions or a bin when the slab is scrapped', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel fabrication job' }));
    await user.selectOptions(await screen.findByLabelText('Disposition for slab SL-100'), 'scrapped');

    expect(screen.queryByLabelText(/Put-away bin/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record disposition for slab SL-100' }));

    expect(fabricationService.recordDisposition).toHaveBeenCalledWith('job-1', 'slab-1', {
      disposition: 'scrapped', recoveredArea: undefined,
      lengthMm: undefined, widthMm: undefined, thicknessMm: undefined, destinationBinUuid: undefined,
    });
  });
});

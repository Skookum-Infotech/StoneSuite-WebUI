import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/fabricationService', () => ({
  fabricationService: { updateStep: vi.fn() },
}));

import { FabricationStepsTab } from './FabricationStepsTab';
import { fabricationService } from '@/services/fabricationService';
import type { FabricationJobStep } from '@/types/fabrication';

const step = (over: Partial<FabricationJobStep>): FabricationJobStep => ({
  code: 'SAW_CUTTING', sequence: 5, status: 'pending', ...over,
});

const STEPS: FabricationJobStep[] = [
  step({ code: 'INTAKE_VERIFY', sequence: 1 }),
  step({ pieceUuid: 'piece-1' }),
  step({ pieceUuid: 'piece-2' }),
];

function renderTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <FabricationStepsTab jobId="job-1" steps={STEPS} canEdit />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fabricationService.updateStep).mockResolvedValue(step({}));
});

describe('FabricationStepsTab', () => {
  it('saves one piece’s step with that piece’s uuid, not for every piece', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Status for Primary Saw Cutting (piece 2 of 2)'), 'completed');
    await user.click(screen.getByRole('button', { name: 'Save Primary Saw Cutting (piece 2 of 2)' }));

    expect(fabricationService.updateStep).toHaveBeenCalledTimes(1);
    expect(fabricationService.updateStep).toHaveBeenCalledWith('job-1', 'SAW_CUTTING', {
      status: 'completed', notes: undefined, pieceUuid: 'piece-2',
    });
  });

  it('keeps each piece’s draft separate even though the rows share a step code', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Status for Primary Saw Cutting (piece 1 of 2)'), 'in_progress');

    expect(screen.getByLabelText('Status for Primary Saw Cutting (piece 1 of 2)')).toHaveValue('in_progress');
    expect(screen.getByLabelText('Status for Primary Saw Cutting (piece 2 of 2)')).toHaveValue('pending');
    expect(screen.getByRole('button', { name: 'Save Primary Saw Cutting (piece 1 of 2)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save Primary Saw Cutting (piece 2 of 2)' })).toBeDisabled();
  });

  it('sends no pieceUuid for a whole-job step', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Status for Order Intake & Verification'), 'completed');
    await user.click(screen.getByRole('button', { name: 'Save Order Intake & Verification' }));

    expect(fabricationService.updateStep).toHaveBeenCalledWith('job-1', 'INTAKE_VERIFY', {
      status: 'completed', notes: undefined, pieceUuid: undefined,
    });
  });

  it('requires a note to skip a step, per row', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.selectOptions(screen.getByLabelText('Status for Primary Saw Cutting (piece 1 of 2)'), 'skipped');
    await user.click(screen.getByRole('button', { name: 'Save Primary Saw Cutting (piece 1 of 2)' }));

    expect(await screen.findByText('A skipped step requires a note explaining why.')).toBeInTheDocument();
    expect(fabricationService.updateStep).not.toHaveBeenCalled();
  });
});

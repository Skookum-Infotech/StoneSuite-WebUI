import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusSelect } from './StatusSelect';
import type { StatusOption } from '@/lib/statusTransitions';

const STATUSES: StatusOption[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
];
const ALLOWED_TRANSITIONS: Record<string, string[]> = { DRFT: ['PAPV'], PAPV: [] };

describe('StatusSelect — labelFor', () => {
  it('shows the plain status label when labelFor is omitted', async () => {
    const user = userEvent.setup();
    render(
      <StatusSelect
        value="DRFT"
        onChange={vi.fn()}
        statuses={STATUSES}
        allowedTransitions={ALLOWED_TRANSITIONS}
        variant="pill"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Pending Approval' })).toBeInTheDocument();
  });

  it('shows the labelFor override instead of the plain status label when provided', async () => {
    const user = userEvent.setup();
    render(
      <StatusSelect
        value="DRFT"
        onChange={vi.fn()}
        statuses={STATUSES}
        allowedTransitions={ALLOWED_TRANSITIONS}
        variant="pill"
        labelFor={(option, fromCode) => `${fromCode} -> ${option.code}: Submit for Approval`}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'DRFT -> PAPV: Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Pending Approval' })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DailyDigestCard } from './DailyDigestCard';
import { automationDigestService } from '@/services/automationDigestService';
import type { DigestPrefs } from '@/types/automationDigest';

vi.mock('@/services/automationDigestService', () => ({
  automationDigestService: { get: vi.fn(), save: vi.fn() },
}));

const getMock = vi.mocked(automationDigestService.get);
const saveMock = vi.mocked(automationDigestService.save);

const OFF: DigestPrefs = {
  enabled: false, sendHour: 8, includeInstalls: true, includeVendorBills: true, includeApprovals: true, skipEmpty: true,
};

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DailyDigestCard />
    </QueryClientProvider>,
  );
}

describe('DailyDigestCard', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue(OFF);
    saveMock.mockReset().mockImplementation((p) => Promise.resolve(p));
  });

  it('starts off, with Save disabled until something changes', async () => {
    renderCard();
    expect(await screen.findByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves the chosen hour and sections', async () => {
    renderCard();
    await userEvent.click(await screen.findByRole('switch'));
    await userEvent.selectOptions(screen.getByLabelText('Send it at'), '14');
    await userEvent.click(screen.getByRole('checkbox', { name: /Vendor bills due/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({ ...OFF, enabled: true, sendHour: 14, includeVendorBills: false }),
    );
  });

  it('asks for at least one section while on, and does not save', async () => {
    renderCard();
    await userEvent.click(await screen.findByRole('switch'));
    for (const name of [/Upcoming installations/, /Vendor bills due/, /Pending approvals/]) {
      await userEvent.click(screen.getByRole('checkbox', { name }));
    }
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one thing to include.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('offers a retry when it cannot load', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'));
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('switch')).toBeInTheDocument();
  });
});

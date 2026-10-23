import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';

vi.mock('@/services/proposedActionService', () => ({
  proposedActionService: { list: vi.fn(), get: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
}));

import { ProposedActionCard } from './ProposedActionCard';
import { proposedActionService } from '@/services/proposedActionService';
import { makeProposedAction } from '@/test/proposedActionFixtures';
import type { ProposedAction } from '@/types/proposedAction';

function renderCard(action: ProposedAction, cb: { onConfirmed?: () => void; onCancelled?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProposedActionCard action={action} {...cb} />
    </QueryClientProvider>,
  );
}

function httpError(status: number, message: string): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { status, data: { success: false, message } } as never;
  return err;
}

beforeEach(() => vi.clearAllMocks());

describe('ProposedActionCard', () => {
  it('pending: renders preview, fields, source and labelled buttons', () => {
    renderCard(makeProposedAction());
    expect(screen.getByRole('article', { name: 'Create customer Acme' })).toBeInTheDocument();
    expect(screen.getByText('Adds a new customer record')).toBeInTheDocument();
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('a@acme.test')).toBeInTheDocument();
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeEnabled();
  });

  it('shows the docextract source badge', () => {
    renderCard(makeProposedAction({ source: 'docextract' }));
    expect(screen.getByText('Document extraction')).toBeInTheDocument();
  });

  it('confirm: disables both buttons while pending, then shows the result', async () => {
    let resolve!: (v: never) => void;
    vi.mocked(proposedActionService.confirm).mockReturnValue(new Promise((r) => (resolve = r as never)));
    const onConfirmed = vi.fn();
    renderCard(makeProposedAction(), { onConfirmed });

    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeDisabled();
    expect(proposedActionService.confirm).toHaveBeenCalledWith('pa-1');

    const done = makeProposedAction({
      status: 'confirmed',
      resultRef: { resource: 'customer', recordId: 'r1', label: 'CUST-0001' },
    });
    resolve({ action: done, replayed: false, message: '' } as never);

    expect(await screen.findByText(/CUST-0001/)).toBeInTheDocument();
    expect(onConfirmed).toHaveBeenCalledWith(done);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('cancel: calls the service and shows the cancelled state', async () => {
    const cancelled = makeProposedAction({ status: 'cancelled' });
    vi.mocked(proposedActionService.cancel).mockResolvedValue(cancelled);
    const onCancelled = vi.fn();
    renderCard(makeProposedAction(), { onCancelled });

    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));

    expect(await screen.findByText(/was cancelled/)).toBeInTheDocument();
    expect(onCancelled).toHaveBeenCalledWith(cancelled);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('422: shows the server message in an alert and keeps buttons actionable', async () => {
    vi.mocked(proposedActionService.confirm).mockRejectedValue(httpError(422, 'Email is invalid'));
    renderCard(makeProposedAction());
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is invalid');
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeEnabled();
  });

  it('403: shows a permission message', async () => {
    vi.mocked(proposedActionService.confirm).mockRejectedValue(httpError(403, 'forbidden'));
    renderCard(makeProposedAction());
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission');
    expect(screen.queryByText('This action is no longer available.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm/ })).toBeEnabled();
  });

  it('404 on confirm: shows the unavailable state with no buttons and no error alert text', async () => {
    vi.mocked(proposedActionService.confirm).mockRejectedValue(httpError(404, 'not found'));
    renderCard(makeProposedAction());
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(await screen.findByText('This action is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    expect(screen.queryByText(/do not have permission/)).not.toBeInTheDocument();
  });

  it('404 on cancel: shows the unavailable state with no buttons', async () => {
    vi.mocked(proposedActionService.cancel).mockRejectedValue(httpError(404, 'not found'));
    renderCard(makeProposedAction());
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(await screen.findByText('This action is no longer available.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('410: switches to the expired state', async () => {
    vi.mocked(proposedActionService.confirm).mockRejectedValue(httpError(410, 'expired'));
    renderCard(makeProposedAction());
    await userEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(await screen.findByText(/expired and can no longer/)).toBeInTheDocument();
    expect(screen.queryByText('This action is no longer available.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('expired prop: no buttons', () => {
    renderCard(makeProposedAction({ status: 'expired' }));
    expect(screen.getByText(/expired and can no longer/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('failed: shows errorMessage, no buttons', () => {
    renderCard(makeProposedAction({ status: 'failed', errorMessage: 'Duplicate email' }));
    expect(screen.getByText('Duplicate email')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('exposes polite status and assertive alert live regions', () => {
    renderCard(makeProposedAction());
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('buttons are keyboard operable', async () => {
    vi.mocked(proposedActionService.cancel).mockResolvedValue(makeProposedAction({ status: 'cancelled' }));
    renderCard(makeProposedAction());
    const confirm = screen.getByRole('button', { name: /Confirm/ });
    await userEvent.tab();
    expect(confirm).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(proposedActionService.cancel).toHaveBeenCalledWith('pa-1');
  });
});

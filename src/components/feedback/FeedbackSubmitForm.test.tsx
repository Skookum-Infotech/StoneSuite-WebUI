import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/services/feedbackService', () => ({
  feedbackService: { submit: vi.fn(), presignAttachments: vi.fn(), confirmAttachments: vi.fn() },
}));
vi.mock('@/services/attachmentService', () => ({ attachmentService: { uploadToR2: vi.fn() } }));

import { FeedbackSubmitForm } from './FeedbackSubmitForm';
import { feedbackService } from '@/services/feedbackService';
import { useLastAppPathStore } from '@/store/useLastAppPathStore';
import type { FeedbackTicket } from '@/types/feedback';

const SUBMITTED_TICKET: FeedbackTicket = {
  id: 'ticket-1',
  ticketSeq: 12,
  ticketNumber: 'FB-12',
  tenantId: 'tenant-1',
  reporterKind: 'staff',
  reporterEmail: 'reporter@example.com',
  reporterName: 'Reporter',
  category: 'general',
  description: 'Totals look wrong',
  status: 'new',
  priority: 'normal',
  reporterLastSeenAt: '2026-09-20T10:00:00Z',
  createdAt: '2026-09-20T10:00:00Z',
  updatedAt: '2026-09-20T10:00:00Z',
};

function renderForm(handlers: { onSubmitted?: () => void; onViewTicket?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/support?tab=new']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(
    <FeedbackSubmitForm onSubmitted={handlers.onSubmitted ?? vi.fn()} onViewTicket={handlers.onViewTicket ?? vi.fn()} />,
    { wrapper },
  );
}

const descriptionBox = () => screen.getByLabelText(/Your Feedback \/ Description/);

async function submitWithDescription(text: string) {
  const user = userEvent.setup();
  await user.type(descriptionBox(), text);
  await user.click(screen.getByRole('button', { name: 'Submit ticket' }));
  await waitFor(() => expect(feedbackService.submit).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(feedbackService.submit).mockResolvedValue(SUBMITTED_TICKET);
  // The store is a module-level singleton, so it outlives any one render().
  useLastAppPathStore.setState({ path: '' });
});

// The form now lives on /support, so the router's own location says nothing
// about where the problem happened — it has to come from the page the
// reporter was on before they opened Support.
describe('FeedbackSubmitForm ticket context', () => {
  it('pre-fills "Where did this happen?" from the page the reporter came from', () => {
    useLastAppPathStore.setState({ path: '/sales/invoice/9' });

    renderForm();

    expect(screen.getByLabelText('Where did this happen?')).toHaveValue('sales');
  });

  it('files the ticket against the page the reporter came from', async () => {
    useLastAppPathStore.setState({ path: '/sales/invoice/9?tab=lines' });
    renderForm();

    await submitWithDescription('Totals look wrong');

    expect(feedbackService.submit).toHaveBeenCalledWith(
      expect.objectContaining({ area: 'sales', pageUrl: '/sales/invoice/9?tab=lines' }),
    );
  });

  // e.g. a hard reload straight onto /support: no earlier page is known, and
  // the Support page's own URL would only mislead whoever triages the ticket.
  it('sends no pageUrl when no earlier page is known', async () => {
    renderForm();

    await submitWithDescription('Totals look wrong');

    const [payload] = vi.mocked(feedbackService.submit).mock.calls[0];
    expect(payload.pageUrl).toBeUndefined();
    expect(payload.area).toBe('other');
  });

  // What gets attached is the reporter's to know: show it before they submit.
  it('shows the page it will attach, when one is known', () => {
    useLastAppPathStore.setState({ path: '/sales/invoice/9' });

    renderForm();

    expect(screen.getByText('/sales/invoice/9')).toBeInTheDocument();
  });

  it('shows no page panel when none is known', () => {
    renderForm();

    expect(screen.queryByText(/Page we.ll attach/)).not.toBeInTheDocument();
  });
});

describe('FeedbackSubmitForm rating', () => {
  it('sends the rating chosen in the side panel with the ticket', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    await submitWithDescription('Totals look wrong');

    expect(feedbackService.submit).toHaveBeenCalledWith(expect.objectContaining({ rating: 4 }));
  });

  it('sends no rating when none was chosen', async () => {
    renderForm();

    await submitWithDescription('Totals look wrong');

    const [payload] = vi.mocked(feedbackService.submit).mock.calls[0];
    expect(payload.rating).toBeNull();
  });
});

describe('FeedbackSubmitForm after submitting', () => {
  it('confirms the ticket number and offers to open it', async () => {
    const onViewTicket = vi.fn();
    const user = userEvent.setup();
    renderForm({ onViewTicket });
    await submitWithDescription('Totals look wrong');

    expect(await screen.findByRole('heading', { name: 'Ticket FB-12 submitted' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View ticket' }));

    expect(onViewTicket).toHaveBeenCalledTimes(1);
    expect(onViewTicket).toHaveBeenCalledWith(SUBMITTED_TICKET);
  });

  it('tells the page a ticket was filed', async () => {
    const onSubmitted = vi.fn();
    renderForm({ onSubmitted });

    await submitWithDescription('Totals look wrong');

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(SUBMITTED_TICKET));
  });

  it('starts a fresh form for "Submit another"', async () => {
    const user = userEvent.setup();
    renderForm();
    await submitWithDescription('Totals look wrong');

    await user.click(await screen.findByRole('button', { name: 'Submit another' }));

    expect(descriptionBox()).toHaveValue('');
  });

  // The ticket already exists by the time files are uploaded, so a failed
  // upload must read as "filed, but…", never as "your report was lost".
  it('says the ticket was filed even when its files could not be attached', async () => {
    vi.mocked(feedbackService.presignAttachments).mockRejectedValue(new Error('Storage unavailable'));
    const user = userEvent.setup();
    const { container } = renderForm();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['pixels'], 'shot.png', { type: 'image/png' }));

    await submitWithDescription('Totals look wrong');

    expect(await screen.findByRole('heading', { name: 'Ticket FB-12 submitted' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable');
  });
});

describe('FeedbackSubmitForm validation and failure', () => {
  it('asks for a description and files nothing without one', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByText('Please describe what happened.')).toBeInTheDocument();
    expect(feedbackService.submit).not.toHaveBeenCalled();
  });

  it('shows the failure and keeps what was typed when submitting fails', async () => {
    vi.mocked(feedbackService.submit).mockRejectedValue(new Error('Ticket service unavailable'));
    const user = userEvent.setup();
    renderForm();

    await user.type(descriptionBox(), 'Totals look wrong');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByText('Ticket service unavailable')).toBeInTheDocument();
    expect(descriptionBox()).toHaveValue('Totals look wrong');
  });
});

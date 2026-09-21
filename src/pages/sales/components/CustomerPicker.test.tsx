import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/crmService', () => ({
  crmService: { searchRecords: vi.fn() },
}));
vi.mock('@/services/lookupService', () => ({
  lookupService: { getCrmLookups: vi.fn() },
}));

import { CustomerPicker, type CustomerRef } from './CustomerPicker';
import { crmService } from '@/services/crmService';
import { lookupService, type CrmLookups } from '@/services/lookupService';
import type { RecordPage, WorkflowRecord } from '@/types/tenant';

const LOOKUPS: Partial<CrmLookups> = {
  // Every customer status plus one from another stage: only Active may be listed.
  crmStatuses: [
    { id: 1, code: 'PDIS', name: 'In Discussion' },
    { id: 3, code: 'CDRF', name: 'Draft' },
    { id: 4, code: 'CACT', name: 'Active' },
    { id: 5, code: 'CINA', name: 'Inactive' },
    { id: 6, code: 'CCHD', name: 'Credit Hold' },
  ],
};
const ACTIVE_STATUS_ID = '4';
const ACME: CustomerRef = { id: 'cust-1', name: 'Acme Corp' };

function mockSearch(records: CustomerRef[]) {
  const page: RecordPage = {
    records: records.map((r) => ({
      id: r.id, workflowId: '', currentStateId: '', coreFields: { customer_name: r.name },
      customFields: {}, createdAt: '', updatedAt: '',
    })) as WorkflowRecord[],
    nextCursor: '',
    hasMore: false,
    scope: 'all',
  };
  vi.mocked(crmService.searchRecords).mockResolvedValue(page);
}

function renderPicker(props: Partial<Parameters<typeof CustomerPicker>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CustomerPicker value={null} onChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupService.getCrmLookups).mockResolvedValue(LOOKUPS as CrmLookups);
});

describe('CustomerPicker', () => {
  it('lists only Active customers — not Draft, Inactive or Credit Hold ones', async () => {
    mockSearch([ACME]);
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('textbox', { name: 'Search billing customer' }));
    await screen.findByRole('button', { name: /Acme Corp/ });

    expect(crmService.searchRecords).toHaveBeenCalledTimes(1);
    const [workflowKey, request] = vi.mocked(crmService.searchRecords).mock.calls[0];
    expect(workflowKey).toBe('customer');
    expect(request.filters).toContainEqual({ field: 'status', op: 'in', value: [ACTIVE_STATUS_ID] });
  });

  it('says so when there are no Active customers to browse', async () => {
    mockSearch([]);
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('textbox', { name: 'Search billing customer' }));

    expect(await screen.findByText('No active customers available.')).toBeInTheDocument();
  });

  it('picks a customer on click', async () => {
    mockSearch([ACME]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onChange });

    await user.click(screen.getByRole('textbox', { name: 'Search billing customer' }));
    await user.type(screen.getByRole('textbox', { name: 'Search billing customer' }), 'Acme');
    await user.click(await screen.findByRole('button', { name: /Acme Corp/ }));

    expect(onChange).toHaveBeenCalledWith(ACME);
  });

  it('warns and offers Create when nothing matches', async () => {
    mockSearch([]);
    const onCreateNew = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onCreateNew });

    const input = screen.getByRole('textbox', { name: 'Search billing customer' });
    await user.click(input);
    await user.type(input, 'Wayne Enterprises');

    expect(await screen.findByText(/“Wayne Enterprises” isn't an existing customer/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create “Wayne Enterprises” as a new customer' }));
    expect(onCreateNew).toHaveBeenCalledWith('Wayne Enterprises');
  });

  it('only warns, with no create action, when the caller omits onCreateNew', async () => {
    mockSearch([]);
    const user = userEvent.setup();
    renderPicker();

    const input = screen.getByRole('textbox', { name: 'Search billing customer' });
    await user.click(input);
    await user.type(input, 'Wayne Enterprises');

    expect(await screen.findByText(/Ask someone with customer access/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a new customer/ })).not.toBeInTheDocument();
  });

  it('hides Create once the typed name exactly matches an existing customer', async () => {
    mockSearch([ACME]);
    const user = userEvent.setup();
    renderPicker({ onCreateNew: vi.fn() });

    const input = screen.getByRole('textbox', { name: 'Search billing customer' });
    await user.click(input);
    await user.type(input, 'acme corp');

    expect(await screen.findByRole('button', { name: /Acme Corp/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /as a new customer/ })).not.toBeInTheDocument();
  });

  it('shows no warning while just browsing with an empty search', async () => {
    mockSearch([ACME]);
    const user = userEvent.setup();
    renderPicker({ onCreateNew: vi.fn() });

    await user.click(screen.getByRole('textbox', { name: 'Search billing customer' }));

    expect(await screen.findByRole('button', { name: /Acme Corp/ })).toBeInTheDocument();
    expect(screen.queryByText(/isn't an existing customer/)).not.toBeInTheDocument();
  });
});

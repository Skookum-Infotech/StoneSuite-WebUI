import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider, useNavigate, useSearchParams } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { useRecordCreateReturn } from './useRecordCreateReturn';
import { useUserPermissions } from './useUserPermissions';
import { readStash, returnRouterState, writeStash } from '@/lib/recordCreateReturn';

interface CustomerRef { id: string; name: string }
const CREATED: CustomerRef = { id: 'cust-new', name: 'Acme Corp' };
const DOC_PATH = '/sales/quote/new';

// A stand-in for an Add-document page: one text field plus the customer
// picker's round trip, wired exactly like AddQuotePage/AddPaymentPage/etc.
function DocumentPage() {
  const customerReturn = useRecordCreateReturn<{ notes: string }, CustomerRef>(
    'customer', '/crm/customer/new', { resource: 'customer', action: 'create' },
  );
  const [notes, setNotes] = useState(customerReturn.restored?.notes ?? '');
  const [customer, setCustomer] = useState<CustomerRef | null>(null);

  useEffect(() => {
    if (customerReturn.createdRef) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomer(customerReturn.createdRef);
      customerReturn.consumeCreated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerReturn.createdRef]);

  const { startCreate } = customerReturn.provide({ notes });

  return (
    <div>
      <input aria-label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <p>Customer: {customer?.name ?? 'none'}</p>
      {startCreate && (
        <button type="button" onClick={() => startCreate('Acme Corp')}>Create Customer</button>
      )}
    </div>
  );
}

// Stand-in for Inventory → New Item's contract, reused generically here for
// "Create Customer" (AddCustomerPage/AddVendorPage follow the exact same
// returnTo/name-param and router-state contract — see AddItemPage.tsx).
function NewRecordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get('returnTo') ?? '/';
  return (
    <div>
      <p>New record named {params.get('name')}</p>
      <button type="button" onClick={() => navigate(returnTo, { state: returnRouterState(CREATED) })}>Save</button>
      <button type="button" onClick={() => navigate(returnTo, { state: returnRouterState(null) })}>Cancel</button>
    </div>
  );
}

function renderApp(initialPath = DOC_PATH) {
  const router = createMemoryRouter(
    [
      { path: DOC_PATH, element: <DocumentPage /> },
      { path: '/crm/customer/new', element: <NewRecordPage /> },
      { path: '/elsewhere', element: <Link to={DOC_PATH}>Open quote</Link> },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

function mockCanCreate(allowed: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) => allowed && resource === 'customer' && action === 'create',
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockCanCreate(true);
});

describe('Create Customer/Vendor round trip', () => {
  it('returns to the document with its unsaved work and the created record applied', async () => {
    const user = userEvent.setup({ delay: null });
    renderApp();

    await user.type(screen.getByLabelText('Notes'), 'Rush job');
    await user.click(screen.getByRole('button', { name: 'Create Customer' }));
    expect(await screen.findByText('New record named Acme Corp')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByLabelText('Notes')).toHaveValue('Rush job');
    expect(screen.getByText('Customer: Acme Corp')).toBeInTheDocument();
    expect(readStash()).toBeNull();
  });

  it('restores the unsaved work but leaves the field unset when the user cancels', async () => {
    const user = userEvent.setup({ delay: null });
    renderApp();

    await user.type(screen.getByLabelText('Notes'), 'Rush job');
    await user.click(screen.getByRole('button', { name: 'Create Customer' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByLabelText('Notes')).toHaveValue('Rush job');
    expect(screen.getByText('Customer: none')).toBeInTheDocument();
  });

  it('does not resurrect an old stash on a fresh visit to the same page', async () => {
    writeStash({ kind: 'customer', returnTo: DOC_PATH, page: { notes: 'Stale' } });
    const user = userEvent.setup({ delay: null });
    renderApp('/elsewhere');

    await user.click(screen.getByRole('link', { name: 'Open quote' }));

    expect(await screen.findByLabelText('Notes')).toHaveValue('');
    expect(readStash()).toBeNull();
  });

  it('offers no create action when the user lacks create permission', async () => {
    mockCanCreate(false);
    renderApp();

    expect(screen.queryByRole('button', { name: 'Create Customer' })).not.toBeInTheDocument();
  });
});

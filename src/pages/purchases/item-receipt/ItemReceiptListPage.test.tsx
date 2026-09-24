import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('./components/ItemReceiptTable', () => ({ ItemReceiptTable: () => null }));
vi.mock('./components/PurchaseOrderPickerDialog', () => ({ PurchaseOrderPickerDialog: () => null }));

import ItemReceiptListPage from './ItemReceiptListPage';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(denied: string[] = []) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => !denied.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => vi.clearAllMocks());

// A new receipt is saved and posted in one step, so starting one takes both grants.
describe('ItemReceiptListPage — New Receipt', () => {
  it('is offered with item_receipt:create and item_receipt:transition', () => {
    mockPermissions();
    render(<ItemReceiptListPage />);

    expect(screen.getByRole('button', { name: /New Receipt/ })).toBeInTheDocument();
  });

  it.each(['item_receipt:create', 'item_receipt:transition'])('is hidden without %s', (denied) => {
    mockPermissions([denied]);
    render(<ItemReceiptListPage />);

    expect(screen.queryByRole('button', { name: /New Receipt/ })).not.toBeInTheDocument();
  });
});

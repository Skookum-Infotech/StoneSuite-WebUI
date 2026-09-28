import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { navigate, pickerProps } = vi.hoisted(() => ({
  navigate: vi.fn(),
  pickerProps: { current: {} as { onCreatePurchaseOrder?: () => void } },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('./components/ItemReceiptTable', () => ({ ItemReceiptTable: () => null }));
vi.mock('./components/PurchaseOrderPickerDialog', () => ({
  PurchaseOrderPickerDialog: (props: { onCreatePurchaseOrder?: () => void }) => {
    pickerProps.current = props;
    return null;
  },
}));

import ItemReceiptListPage from './ItemReceiptListPage';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function mockPermissions(denied: string[] = []) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => !denied.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

beforeEach(() => {
  vi.clearAllMocks();
  pickerProps.current = {};
});

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

// The picker's "nothing found" state can hand off to PO creation, but only for
// someone the PO Add route would let through.
describe('ItemReceiptListPage — create purchase order from the picker', () => {
  it('sends a user with purchase_order:create to the new-PO page', async () => {
    mockPermissions();
    render(<ItemReceiptListPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: /New Receipt/ }));

    pickerProps.current.onCreatePurchaseOrder?.();

    expect(navigate).toHaveBeenCalledWith('/purchases/purchase_order/new');
  });

  it('does not offer it without purchase_order:create', async () => {
    mockPermissions(['purchase_order:create']);
    render(<ItemReceiptListPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: /New Receipt/ }));

    expect(pickerProps.current.onCreatePurchaseOrder).toBeUndefined();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useInventoryLookups', () => ({ useInventoryLookups: vi.fn() }));

import { ReceiptWarehouseField } from './ReceiptWarehouseField';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { RECEIPT_HEADER_FIELDS } from '@/lib/itemReceiptForm';
import type { Warehouse } from '@/types/inventory';

const wh = (over: Partial<Warehouse>): Warehouse => ({
  id: 'w1', warehouseId: 1, name: 'Main Yard', code: 'MAIN', addrLine1: '', addrLine2: '', addrCity: '', addrZip: '',
  isDefault: false, isActive: true, isSystem: false, ...over,
});

const found = RECEIPT_HEADER_FIELDS.find((f) => f.key === 'warehouse_id');
if (!found) throw new Error('warehouse_id is missing from RECEIPT_HEADER_FIELDS');
const field = found;

function renderField(value: string, warehouses: Warehouse[]) {
  vi.mocked(useInventoryLookups).mockReturnValue({
    lookups: { warehouses }, isLoading: false, error: null,
  } as unknown as ReturnType<typeof useInventoryLookups>);
  const set = vi.fn();
  render(<ReceiptWarehouseField field={field} value={value} set={set} />);
  return { set };
}

describe('ReceiptWarehouseField', () => {
  it('is a required warehouse picker', () => {
    expect(field).toMatchObject({ type: 'warehouse', required: true });
    renderField('', [wh({})]);
    expect(screen.getByRole('combobox', { name: 'Warehouse' })).toBeRequired();
  });

  it('lists active warehouses, marking the default', () => {
    renderField('', [wh({ id: 'a', name: 'Main Yard', isDefault: true }), wh({ id: 'b', name: 'Annex' })]);
    expect(screen.getByRole('option', { name: 'Main Yard (Default)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Annex' })).toBeInTheDocument();
  });

  it('does not offer an inactive warehouse', () => {
    renderField('', [wh({ id: 'a', name: 'Main Yard' }), wh({ id: 'b', name: 'Closed Yard', isActive: false })]);
    expect(screen.queryByRole('option', { name: 'Closed Yard' })).not.toBeInTheDocument();
  });

  it('keeps showing an inactive warehouse the receipt already points at', () => {
    renderField('b', [wh({ id: 'a', name: 'Main Yard' }), wh({ id: 'b', name: 'Closed Yard', isActive: false })]);
    expect(screen.getByRole('option', { name: 'Closed Yard' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Warehouse' })).toHaveValue('b');
  });

  it('reports the chosen warehouse\'s uuid under the field key', async () => {
    const { set } = renderField('', [wh({ id: 'a', name: 'Main Yard' }), wh({ id: 'b', name: 'Annex' })]);

    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Warehouse' }), 'Annex');

    expect(set).toHaveBeenCalledWith('warehouse_id', 'b');
  });
});

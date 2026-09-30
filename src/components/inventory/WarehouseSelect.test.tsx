import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WarehouseSelect } from './WarehouseSelect';
import type { Warehouse } from '@/types/inventory';

const location = (over: Partial<Warehouse>): Warehouse => ({
  id: 'a', warehouseId: 1, name: 'Main Yard', phone: '',
  address: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
  isDefault: false, ...over,
});

const LOCATIONS = [
  location({ id: 'main', warehouseId: 1, name: 'Main Yard', isDefault: true }),
  location({ id: 'annex', warehouseId: 2, name: 'Annex' }),
];

describe('WarehouseSelect', () => {
  it('is a "Location" picker with a Location placeholder', () => {
    render(<WarehouseSelect warehouses={LOCATIONS} value="" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Location' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '— Select Location —' })).toBeInTheDocument();
  });

  it('lists every location and marks the default one', () => {
    render(<WarehouseSelect warehouses={LOCATIONS} value="" onChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'Main Yard (Default)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Annex' })).toBeInTheDocument();
  });

  it('shows the location it is given as selected', () => {
    render(<WarehouseSelect warehouses={LOCATIONS} value="main" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Location' })).toHaveValue('main');
  });

  it("reports another location's uuid when the user picks it", async () => {
    const onChange = vi.fn();
    render(<WarehouseSelect warehouses={LOCATIONS} value="main" onChange={onChange} />);

    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Location' }), 'Annex');

    expect(onChange).toHaveBeenCalledWith('annex');
  });

  it('honors a custom label such as "Default Location"', () => {
    render(<WarehouseSelect warehouses={LOCATIONS} value="" onChange={vi.fn()} label="Default Location" />);

    expect(screen.getByRole('combobox', { name: 'Default Location' })).toBeInTheDocument();
  });

  it('is disabled and says where to add one when the tenant has no locations', () => {
    render(<WarehouseSelect warehouses={[]} value="" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Location' })).toBeDisabled();
    expect(screen.getByRole('option', { name: /No locations yet.*Company Info/ })).toBeInTheDocument();
  });
});

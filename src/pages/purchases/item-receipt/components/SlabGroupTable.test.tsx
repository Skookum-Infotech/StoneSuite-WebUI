import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlabGroupTable } from './SlabGroupTable';
import { groupSlabs, newDraftSlab, patchGroupMembers, type ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import type { Bin } from '@/types/inventory';

const BINS = [
  { id: 'bin-1', name: 'Rack A', code: 'RA', path: 'RA', depth: 1, unitCount: 0, overCapacity: false, children: [] },
] as unknown as Bin[];

// 3048 x 1524 mm is exactly 10 ft x 5 ft = 50 sq ft.
const slab = (over: Partial<ItemReceiptDraftSlab> = {}) =>
  newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', ...over });

function renderTable(slabs: ItemReceiptDraftSlab[]) {
  const actions = { patch: vi.fn(), expand: vi.fn(), remove: vi.fn() };
  render(<SlabGroupTable rows={groupSlabs(slabs).map((group, i) => ({ group, number: i + 1 }))} bins={BINS} units={{ area: 'SQFT', length: 'mm' }} actions={actions} />);
  return actions;
}

describe('SlabGroupTable', () => {
  it('renders one row per group with its slab count and combined area', () => {
    renderTable([...Array.from({ length: 60 }, () => slab()), slab({ lengthMm: '3000' })]);

    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 groups
    expect(screen.getByText('60 slabs')).toBeInTheDocument();
    expect(screen.getByText('1 slab')).toBeInTheDocument();
    expect(screen.getByText('3000.000')).toBeInTheDocument(); // 60 x 50 sq ft
  });

  it('puts one bin picker on a group of 300, not 300', () => {
    renderTable(Array.from({ length: 300 }, () => slab()));
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('patches the group when a dimension is edited', () => {
    const slabs = [slab(), slab()];
    const actions = renderTable(slabs);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Length (mm) of group 1' }), { target: { value: '3100' } });

    expect(actions.patch).toHaveBeenCalledWith(groupSlabs(slabs)[0].key, { lengthMm: '3100' });
  });

  it('patches the group when a bin is chosen', async () => {
    const user = userEvent.setup();
    const slabs = [slab(), slab()];
    const actions = renderTable(slabs);

    await user.click(screen.getByRole('combobox', { name: 'Bin for group 1' }));
    await user.click(await screen.findByRole('option', { name: /Rack A/ }));

    expect(actions.patch).toHaveBeenCalledWith(groupSlabs(slabs)[0].key, { binId: 'bin-1' });
  });

  it('asks to expand a group to edit its slabs individually', async () => {
    const user = userEvent.setup();
    const slabs = [slab(), slab()];
    const actions = renderTable(slabs);

    await user.click(screen.getByRole('button', { name: 'Edit group 1 slab by slab' }));

    expect(actions.expand).toHaveBeenCalledWith(groupSlabs(slabs)[0].key);
  });

  it('removes a whole group', async () => {
    const user = userEvent.setup();
    const slabs = [slab(), slab()];
    const actions = renderTable(slabs);

    await user.click(screen.getByRole('button', { name: 'Remove group 1' }));

    expect(actions.remove).toHaveBeenCalledWith(groupSlabs(slabs)[0].key);
  });

  it('keeps each slab\'s own supplier code when the group is edited', () => {
    const a = slab({ supplierCode: 'A1' });
    const b = slab({ supplierCode: 'B2' });
    const [group] = groupSlabs([a, b]);

    // What the editor does with the group's patch: only the named field moves.
    const out = patchGroupMembers([a, b], group.memberKeys, { thicknessMm: '20' });

    expect(out.map((s) => s.supplierCode)).toEqual(['A1', 'B2']);
    expect(out.map((s) => s.thicknessMm)).toEqual(['20', '20']);
  });
});

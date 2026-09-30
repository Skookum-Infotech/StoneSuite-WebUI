import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getItem: vi.fn().mockResolvedValue({ id: 'item-1', thicknessMm: 30 }) },
}));

import { PackingListPanel } from './PackingListPanel';
import { inventoryService } from '@/services/inventoryService';
import type { ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';

function renderPanel({ itemId = 'item-1', unitCode = 'SQFT' }: { itemId?: string | null; unitCode?: string } = {}) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PackingListPanel itemId={itemId} unitCode={unitCode} onAdd={onAdd} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onAdd, onClose };
}

// A paste is one change event with the whole text in it; typing tabs and
// newlines character by character would move focus instead.
function paste(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Packing list rows' }), { target: { value: text } });
}

describe('PackingListPanel', () => {
  it('offers nothing to add until something is pasted', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Add slabs' })).toBeDisabled();
  });

  it('reads pasted rows and previews them with the total area', () => {
    renderPanel();

    paste('3048\t1524\t30\tB-1\n3048\t1524\t30\tB-1');

    expect(screen.getByText(/2 slabs read/)).toHaveTextContent('100.000 sq ft in total');
    expect(screen.getAllByText('3048 × 1524 × 30 mm · B-1', { exact: false })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add 2 slabs' })).toBeEnabled();
  });

  it('adds the slabs, with their lot, to the line and closes', async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderPanel();
    paste('3048\t1524\t30\tB-1\n3000\t1500\t30');

    await user.click(screen.getByRole('button', { name: 'Add 2 slabs' }));

    const added = onAdd.mock.calls[0][0] as ItemReceiptDraftSlab[];
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', lot: 'B-1' });
    expect(added[1]).toMatchObject({ lengthMm: '3000', widthMm: '1500', thicknessMm: '30', lot: '' });
    expect(added[0].key).not.toBe(added[1].key);
    expect(onClose).toHaveBeenCalled();
  });

  it('converts a list given in centimetres to millimetres', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPanel();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Packing list units' }), 'cm');
    paste('304.8 152.4 3');

    await user.click(screen.getByRole('button', { name: 'Add 1 slab' }));

    expect(onAdd.mock.calls[0][0][0]).toMatchObject({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' });
  });

  it('converts a list given in inches', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPanel();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Packing list units' }), 'in');
    paste('120 60 1.25');

    await user.click(screen.getByRole('button', { name: 'Add 1 slab' }));

    expect(onAdd.mock.calls[0][0][0]).toMatchObject({ lengthMm: '3048', widthMm: '1524', thicknessMm: '31.75' });
  });

  it('fills a missing thickness from the item', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPanel();
    // The item's thickness arrives asynchronously.
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: 'Default thickness in millimetres' })).toHaveValue(30));
    paste('3048 1524');

    await user.click(screen.getByRole('button', { name: 'Add 1 slab' }));

    expect(onAdd.mock.calls[0][0][0].thicknessMm).toBe('30');
    expect(inventoryService.getItem).toHaveBeenCalledWith('item-1');
  });

  it('uses a thickness typed over the item\'s', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPanel();
    const box = screen.getByRole('spinbutton', { name: 'Default thickness in millimetres' });
    await waitFor(() => expect(box).toHaveValue(30)); // wait for the item's own value before overriding it
    await user.clear(box);
    await user.type(box, '20');
    paste('3048 1524');

    await user.click(screen.getByRole('button', { name: 'Add 1 slab' }));

    expect(onAdd.mock.calls[0][0][0].thicknessMm).toBe('20');
  });

  it('refuses rows with no thickness when there is none to fall back on', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryService.getItem).mockResolvedValueOnce({ id: 'item-2', thicknessMm: 0 } as never);
    const { onAdd } = renderPanel({ itemId: 'item-2' });
    paste('3048 1524');

    expect(await screen.findByText(/Some rows have no thickness/)).toBeInTheDocument();
    const add = screen.getByRole('button', { name: 'Add 1 slab' });
    expect(add).toBeDisabled();
    await user.click(add);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('lists unreadable rows as skipped but still adds the readable ones', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPanel();
    paste('3048 1524 30\nTotal 583.4\n3000 1500 30');

    expect(screen.getByText('These rows will be skipped:')).toBeInTheDocument();
    expect(screen.getByText('Row 2: needs both a length and a width.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add 2 slabs' }));

    expect(onAdd.mock.calls[0][0]).toHaveLength(2);
  });

  it('warns when the sizes look like the wrong unit', () => {
    renderPanel();

    paste('3048 1524 30'); // fine as millimetres
    expect(screen.queryByText(/look unusually/)).not.toBeInTheDocument();

    paste('30 15 3'); // the same slab read as millimetres by mistake
    expect(screen.getByText(/look unusually small/)).toBeInTheDocument();
  });

  it('warns about slabs that look too large too', () => {
    renderPanel();
    paste('30480 15240 30');
    expect(screen.getByText(/look unusually large/)).toBeInTheDocument();
  });

  it('cancels without adding', async () => {
    const user = userEvent.setup();
    const { onAdd, onClose } = renderPanel();
    paste('3048 1524 30');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('does not fetch an item it has no id for', () => {
    vi.mocked(inventoryService.getItem).mockClear();
    renderPanel({ itemId: null });
    expect(inventoryService.getItem).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add slabs' })).toBeDisabled();
  });
});

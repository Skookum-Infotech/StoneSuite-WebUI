import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterRow } from './FilterRow';
import type { CatalogField, CustomFilterRule } from '@/types/customReports';

const FIELDS: CatalogField[] = [
  { key: 'sku', label: 'Line SKU', group: '', type: 'text' },
  { key: 'net_amount', label: 'Net amount', group: '', type: 'money' },
  { key: 'invoice.date', label: 'Invoice date', group: 'Invoice', type: 'date' },
  { key: 'invoice.status', label: 'Invoice status', group: 'Invoice', type: 'status', options: ['Paid', 'Sent'] },
];

function setup(rule: CustomFilterRule) {
  const onChange = vi.fn();
  const view = render(<FilterRow label="Filter 1" rule={rule} fields={FIELDS} onChange={onChange} onRemove={vi.fn()} />);
  const rerender = (next: CustomFilterRule) =>
    view.rerender(<FilterRow label="Filter 1" rule={next} fields={FIELDS} onChange={onChange} onRemove={vi.fn()} />);
  return { onChange, rerender };
}

describe('FilterRow', () => {
  it('edits a text value as the user types', async () => {
    const { onChange } = setup({ field: 'sku', op: 'eq', values: [''] });
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter 1 value' }), 'a');
    expect(onChange).toHaveBeenLastCalledWith({ field: 'sku', op: 'eq', values: ['a'] });
  });

  it('edits both ends of a between filter', async () => {
    const { onChange } = setup({ field: 'net_amount', op: 'between', values: ['', ''] });
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter 1 to' }), '9');
    expect(onChange).toHaveBeenLastCalledWith({ field: 'net_amount', op: 'between', values: ['', '9'] });
    expect(screen.getByRole('textbox', { name: 'Filter 1 from' })).toBeInTheDocument();
  });

  it('toggles status options on and off', async () => {
    const { onChange } = setup({ field: 'invoice.status', op: 'in', values: ['Paid'] });
    expect(screen.getByRole('button', { name: 'Filter 1: Paid' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Filter 1: Sent' }));
    expect(onChange).toHaveBeenLastCalledWith({ field: 'invoice.status', op: 'in', values: ['Paid', 'Sent'] });
    await userEvent.click(screen.getByRole('button', { name: 'Filter 1: Paid' }));
    expect(onChange).toHaveBeenLastCalledWith({ field: 'invoice.status', op: 'in', values: [] });
  });

  it('a relative date preset needs no dates; Custom shows the two date pickers', async () => {
    const { onChange } = setup({ field: 'invoice.date', op: 'date_range', values: [], preset: 'this-quarter' });
    expect(screen.queryByText('to')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filter 1 date range: Last month' }));
    expect(onChange).toHaveBeenLastCalledWith({ field: 'invoice.date', op: 'date_range', values: [], preset: 'last-month' });
    await userEvent.click(screen.getByRole('button', { name: 'Filter 1 date range: Custom' }));
    const custom = onChange.mock.calls.at(-1)?.[0] as CustomFilterRule;
    expect(custom.preset).toBe('custom');
    expect(custom.values).toHaveLength(2);
  });

  it('switching the field starts the new field on its first comparison with nothing filled in', async () => {
    const { onChange } = setup({ field: 'sku', op: 'eq', values: ['abc'] });
    await userEvent.click(screen.getByRole('combobox', { name: 'Filter 1 field' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Invoice date' }));
    expect(onChange).toHaveBeenLastCalledWith({ field: 'invoice.date', op: 'date_range', values: [], preset: 'this-quarter' });
  });

  it('an "is one of" list on plain text is parsed when the box loses focus', async () => {
    const { onChange } = setup({ field: 'sku', op: 'in', values: [] });
    const box = screen.getByRole('textbox', { name: 'Filter 1 values' });
    await userEvent.type(box, 'a, b ,, c');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith({ field: 'sku', op: 'in', values: ['a', 'b', 'c'] });
  });

  it('shows the new values when a different filter is put in this row (e.g. after another row is removed)', () => {
    const { rerender } = setup({ field: 'sku', op: 'in', values: ['first', 'one'] });
    expect(screen.getByRole('textbox', { name: 'Filter 1 values' })).toHaveValue('first, one');
    rerender({ field: 'sku', op: 'in', values: ['second'] });
    expect(screen.getByRole('textbox', { name: 'Filter 1 values' })).toHaveValue('second');
  });

  it('keeps what the user is typing while their own edits flow back in', async () => {
    const { onChange, rerender } = setup({ field: 'sku', op: 'in', values: [] });
    const box = screen.getByRole('textbox', { name: 'Filter 1 values' });
    await userEvent.type(box, 'a,');
    await userEvent.tab();
    rerender({ field: 'sku', op: 'in', values: ['a'] });
    expect(box).toHaveValue('a,');
    expect(onChange).toHaveBeenLastCalledWith({ field: 'sku', op: 'in', values: ['a'] });
  });
});

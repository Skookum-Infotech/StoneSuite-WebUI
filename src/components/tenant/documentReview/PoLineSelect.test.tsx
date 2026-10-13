import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PoLineSelect } from './PoLineSelect';

describe('PoLineSelect', () => {
  it('lists the fitting PO lines and reports the pick', async () => {
    const onChange = vi.fn();
    render(<PoLineSelect label="Line 2" value="" onChange={onChange} choices={[{ id: 'a', label: 'PO line 1: Slab' }, { id: 'b', label: 'PO line 2: Slab' }]} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Purchase order line for Line 2' }), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

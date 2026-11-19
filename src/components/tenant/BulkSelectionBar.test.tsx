import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkSelectionBar } from './BulkSelectionBar';

function setup(props: Partial<React.ComponentProps<typeof BulkSelectionBar>> = {}) {
  const onExport = vi.fn();
  const onClear = vi.fn();
  render(<BulkSelectionBar count={3} onExport={onExport} onClear={onClear} {...props} />);
  return { onExport, onClear };
}

describe('BulkSelectionBar', () => {
  it.each([1, 3, 25])('says how many rows are selected: %i', (count) => {
    setup({ count });
    expect(screen.getByRole('status')).toHaveTextContent(`${count} selected`);
  });

  it('is a labelled region', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Selected rows' })).toBeInTheDocument();
  });

  it('exports and clears on click', async () => {
    const { onExport, onClear } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Export selected (CSV)' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('can be driven from the keyboard', async () => {
    const { onExport, onClear } = setup();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Export selected (CSV)' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('disables the export while one is running', () => {
    setup({ isExporting: true });
    expect(screen.getByRole('button', { name: 'Export selected (CSV)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
  });
});

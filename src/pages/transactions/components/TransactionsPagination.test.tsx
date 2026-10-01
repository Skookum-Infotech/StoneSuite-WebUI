import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionsPagination } from './TransactionsPagination';

function setup(props: Partial<React.ComponentProps<typeof TransactionsPagination>> = {}) {
  const onPage = vi.fn();
  const onPageSize = vi.fn();
  render(
    <TransactionsPagination page={1} pageSize={25} total={132} onPage={onPage} onPageSize={onPageSize} {...props} />,
  );
  return { onPage, onPageSize };
}

describe('TransactionsPagination', () => {
  it('shows the row range and the total', () => {
    setup({ page: 2 });
    expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 26–50 of 132');
  });

  it('clamps the last range to the total on a short last page', () => {
    setup({ page: 6 });
    expect(screen.getByText(/showing/i)).toHaveTextContent('Showing 126–132 of 132');
  });

  it('marks the current page and offers a numbered strip', () => {
    setup({ page: 2 });
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Page 6' })).toBeInTheDocument(); // 132 / 25 → 6 pages
  });

  it('gives phones a compact "Page X of Y" label alongside the strip', () => {
    setup({ page: 3 });
    expect(screen.getByText('Page 3 of 6')).toBeInTheDocument();
  });

  it('disables first/previous on the first page and next/last on the last', () => {
    const { rerender } = render(
      <TransactionsPagination page={1} pageSize={25} total={132} onPage={vi.fn()} onPageSize={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

    rerender(<TransactionsPagination page={6} pageSize={25} total={132} onPage={vi.fn()} onPageSize={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  it('asks for the right page from each control', async () => {
    const user = userEvent.setup();
    const { onPage } = setup({ page: 3 });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await user.click(screen.getByRole('button', { name: 'First page' }));
    await user.click(screen.getByRole('button', { name: 'Last page' }));
    await user.click(screen.getByRole('button', { name: 'Page 5' }));

    expect(onPage.mock.calls.map(([p]) => p)).toEqual([4, 2, 1, 6, 5]);
  });

  it('offers the page sizes and reports a change', async () => {
    const user = userEvent.setup();
    const { onPageSize } = setup({ pageSize: 25 });

    const select = screen.getByRole('combobox', { name: /rows per page/i });
    expect(select).toHaveValue('25');
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.value)).toEqual(['10', '25', '50', '100']);

    await user.selectOptions(select, '50');
    expect(onPageSize).toHaveBeenCalledWith(50);
  });

  it('elides pages with an ellipsis once there are many', () => {
    setup({ page: 10, pageSize: 10, total: 200 }); // 20 pages
    expect(screen.getByRole('button', { name: 'Page 9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 11' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 20' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Page 5' })).not.toBeInTheDocument();
  });
});

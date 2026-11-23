import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KitHeadingRow } from './KitHeadingRow';
import { KitLineRows } from './KitLineRows';

interface Line { id: string; name: string; kitId?: string; kitName?: string }

function renderRows(lines: Line[]) {
  return render(
    <table>
      <tbody>
        <KitLineRows
          lines={lines}
          colSpan={3}
          renderRow={(line, kitCls) => (
            <tr key={line.id} aria-label={line.name} data-kit={kitCls ? 'yes' : 'no'}>
              <td>{line.name}</td><td>a</td><td>b</td>
            </tr>
          )}
        />
      </tbody>
    </table>,
  );
}

describe('KitLineRows', () => {
  it('draws one heading above each run and marks only that run’s lines', () => {
    renderRows([
      { id: '1', name: 'Plain A' },
      { id: '2', name: 'Countertop', kitId: 'k1', kitName: 'Kitchen' },
      { id: '3', name: 'Sink', kitId: 'k1', kitName: 'Kitchen' },
      { id: '4', name: 'Plain B' },
    ]);

    const rows = screen.getAllByRole('row').map((r) => r.getAttribute('aria-label'));
    expect(rows).toEqual(['Plain A', 'Kit Kitchen', 'Countertop', 'Sink', 'Plain B']);
    expect(screen.getByRole('row', { name: 'Kit Kitchen' })).toHaveTextContent('2 items');
    expect(screen.getByRole('row', { name: 'Countertop' })).toHaveAttribute('data-kit', 'yes');
    expect(screen.getByRole('row', { name: 'Sink' })).toHaveAttribute('data-kit', 'yes');
    expect(screen.getByRole('row', { name: 'Plain A' })).toHaveAttribute('data-kit', 'no');
    expect(screen.getByRole('row', { name: 'Plain B' })).toHaveAttribute('data-kit', 'no');
  });

  it('spans the whole table with the heading and has no remove button on a read-only table', () => {
    renderRows([{ id: '1', name: 'Countertop', kitId: 'k1', kitName: 'Kitchen' }]);

    const heading = screen.getByRole('row', { name: 'Kit Kitchen' });
    expect(heading.querySelector('td')).toHaveAttribute('colspan', '3');
    expect(within(heading).queryByRole('button')).not.toBeInTheDocument();
    expect(heading).toHaveTextContent('1 item');
  });

  it('draws nothing extra for a table with no kit lines', () => {
    renderRows([{ id: '1', name: 'Plain A' }, { id: '2', name: 'Plain B' }]);

    expect(screen.getAllByRole('row')).toHaveLength(2);
  });
});

describe('KitHeadingRow', () => {
  it('offers removal only when an editable table gives it a handler', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <table>
        <tbody>
          <KitHeadingRow name="Kitchen" count={3} colSpan={5} onRemove={onRemove} />
        </tbody>
      </table>,
    );

    await user.click(screen.getByRole('button', { name: 'Remove kit Kitchen and its 3 items' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

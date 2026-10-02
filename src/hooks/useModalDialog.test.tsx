import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModalDialog } from './useModalDialog';

function Harness({ onClose }: { onClose: () => void }) {
  // A fresh callback identity on every render, as an inline arrow would give.
  const ref = useModalDialog(() => onClose());
  const [n, setN] = useState('');
  return (
    <div ref={ref} role="dialog" aria-label="d" tabIndex={-1}>
      <button type="button">first</button>
      <input aria-label="field" value={n} onChange={(e) => setN(e.target.value)} />
    </div>
  );
}

describe('useModalDialog', () => {
  it('does not steal focus back when the callback identity changes on re-render', async () => {
    render(<Harness onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
    await userEvent.type(screen.getByLabelText('field'), 'ab');
    expect(screen.getByLabelText('field')).toHaveFocus();
  });

  it('closes on Escape using the latest callback', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

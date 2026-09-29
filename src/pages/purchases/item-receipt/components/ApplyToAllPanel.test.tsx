import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplyToAllPanel } from './ApplyToAllPanel';

function renderPanel(slabCount = 3) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<ApplyToAllPanel slabCount={slabCount} onApply={onApply} onClose={onClose} />);
  return { onApply, onClose, user: userEvent.setup() };
}

describe('ApplyToAllPanel', () => {
  it('offers nothing to apply until a lot or block is typed', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Apply to all slabs' })).toBeDisabled();
  });

  it('applies the lot and block to every slab', async () => {
    const { onApply, user } = renderPanel(4);
    await user.type(screen.getByRole('textbox', { name: 'Lot for all slabs' }), ' B-1234 ');
    await user.type(screen.getByRole('textbox', { name: 'Block ID for all slabs' }), 'BLK-7');

    await user.click(screen.getByRole('button', { name: 'Apply to all slabs' }));

    expect(onApply).toHaveBeenCalledWith({ lot: 'B-1234', blockId: 'BLK-7' });
    expect(screen.getByRole('status')).toHaveTextContent('Applied to 4 slabs.');
  });

  it('leaves a blank field out, so applying only a lot never wipes block IDs', async () => {
    const { onApply, user } = renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Lot for all slabs' }), 'B-1234');

    await user.click(screen.getByRole('button', { name: 'Apply to all slabs' }));

    expect(onApply).toHaveBeenCalledWith({ lot: 'B-1234' });
    expect(onApply.mock.calls[0][0]).not.toHaveProperty('blockId');
  });

  it('applies only a block when only that is typed', async () => {
    const { onApply, user } = renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Block ID for all slabs' }), 'BLK-7');

    await user.click(screen.getByRole('button', { name: 'Apply to all slabs' }));

    expect(onApply).toHaveBeenCalledWith({ blockId: 'BLK-7' });
  });

  it('ignores whitespace-only input', async () => {
    const { user } = renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Lot for all slabs' }), '   ');
    expect(screen.getByRole('button', { name: 'Apply to all slabs' })).toBeDisabled();
  });

  it('says how many slabs it will touch, singular for one', () => {
    renderPanel(1);
    expect(screen.getByText(/all 1 slab on this line/)).toBeInTheDocument();
  });

  it('cannot apply with no slabs', async () => {
    const { user } = renderPanel(0);
    await user.type(screen.getByRole('textbox', { name: 'Lot for all slabs' }), 'B-1');
    expect(screen.getByRole('button', { name: 'Apply to all slabs' })).toBeDisabled();
  });

  it('clears the confirmation once the text changes again', async () => {
    const { user } = renderPanel();
    const lot = screen.getByRole('textbox', { name: 'Lot for all slabs' });
    await user.type(lot, 'B-1');
    await user.click(screen.getByRole('button', { name: 'Apply to all slabs' }));
    expect(screen.getByRole('status')).toHaveTextContent('Applied');

    await user.type(lot, '2');

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('closes with Done', async () => {
    const { onClose, user } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});

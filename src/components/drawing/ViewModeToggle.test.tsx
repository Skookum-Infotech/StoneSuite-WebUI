import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewModeToggle } from './ViewModeToggle';

describe('ViewModeToggle', () => {
  it('offers 3D while in 2D, and switches to it', async () => {
    const onChange = vi.fn();
    render(<ViewModeToggle mode="2d" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to 3D view' }));
    expect(onChange).toHaveBeenCalledWith('3d');
    expect(screen.queryByRole('button', { name: 'Switch to 2D view' })).toBeNull();
  });

  it('offers 2D while in 3D, and switches back', async () => {
    const onChange = vi.fn();
    render(<ViewModeToggle mode="3d" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to 2D view' }));
    expect(onChange).toHaveBeenCalledWith('2d');
  });
});

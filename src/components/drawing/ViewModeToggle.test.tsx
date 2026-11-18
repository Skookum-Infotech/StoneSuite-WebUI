import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewModeToggle } from './ViewModeToggle';

describe('ViewModeToggle', () => {
  it('marks the current mode as pressed', () => {
    render(<ViewModeToggle mode="2d" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '2D view' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3D view' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the mode that was picked', async () => {
    const onChange = vi.fn();
    render(<ViewModeToggle mode="2d" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '3D view' }));
    expect(onChange).toHaveBeenCalledWith('3d');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandToggle } from './HandToggle';

describe('HandToggle', () => {
  it('says what dragging does while off, and turns on when pressed', async () => {
    const onToggle = vi.fn();
    render(<HandToggle active={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Hand tool off: drag turns the view' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('says what dragging does while on', () => {
    render(<HandToggle active onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Hand tool on: drag moves the view' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

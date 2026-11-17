import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReadOnlyStatusPill } from './ReadOnlyStatusPill';

describe('ReadOnlyStatusPill', () => {
  it('shows the label as plain text, not a control', () => {
    render(<ReadOnlyStatusPill label="Approved" color="#3b82f6" />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('tints the pill with the given color', () => {
    render(<ReadOnlyStatusPill label="Approved" color="#3b82f6" />);

    expect(screen.getByText('Approved').style.getPropertyValue('--pill')).toBe('#3b82f6');
  });

  it('falls back to a neutral tint for a status with no color', () => {
    render(<ReadOnlyStatusPill label="Mystery" />);

    expect(screen.getByText('Mystery').style.getPropertyValue('--pill')).toBe('#8a8580');
  });
});

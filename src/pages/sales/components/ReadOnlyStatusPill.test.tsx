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

    expect(screen.getByText('Approved')).toHaveStyle({ backgroundColor: 'rgba(59, 130, 246, 0.094)' });
  });

  it('falls back to a neutral tint for a status with no color', () => {
    render(<ReadOnlyStatusPill label="Mystery" />);

    expect(screen.getByText('Mystery')).toHaveStyle({ backgroundColor: 'rgba(168, 162, 158, 0.094)' });
  });
});

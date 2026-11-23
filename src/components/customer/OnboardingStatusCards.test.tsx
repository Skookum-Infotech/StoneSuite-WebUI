import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingStatusCards } from './OnboardingStatusCards';

const COUNTS = { pending: 3, invited: 2, active: 10, suspended: 1 };

describe('OnboardingStatusCards', () => {
  it('renders a card with count per status', () => {
    render(<OnboardingStatusCards counts={COUNTS} active={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pending: 3 customers' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Active: 10 customers' })).toBeTruthy();
  });

  it('selects a card on click', () => {
    const onSelect = vi.fn();
    render(<OnboardingStatusCards counts={COUNTS} active={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Invited: 2 customers' }));
    expect(onSelect).toHaveBeenCalledWith('invited');
  });

  it('clears the filter when the active card is clicked and marks it pressed', () => {
    const onSelect = vi.fn();
    render(<OnboardingStatusCards counts={COUNTS} active="active" onSelect={onSelect} />);
    const btn = screen.getByRole('button', { name: 'Active: 10 customers' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

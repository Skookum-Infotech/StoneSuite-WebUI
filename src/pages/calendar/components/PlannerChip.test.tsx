import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlannerChip } from './PlannerChip';
import type { PlannerCard } from '@/lib/plannerCards';

const card: PlannerCard = {
  id: 'c1', kind: 'appointment', at: '2099-03-03T08:00', sortKey: 'k', allDay: false, timeLabel: '8:00 AM',
  statusLabel: 'Cancelled', statusColor: '#a8a29e', chipColor: '#78716c', whenLabel: 'Mar 3', title: 'FJ-1',
  href: '?appointment=a1', openLabel: 'Open visit', customer: 'Acme', stage: '', meta: '', notes: '',
  doneLabel: '', done: false, overdue: false, ariaLabel: 'Install, FJ-1 Acme',
};

describe('PlannerChip', () => {
  it('strikes through and mutes a cancelled card', () => {
    render(<MemoryRouter><PlannerChip card={{ ...card, cancelled: true }} /></MemoryRouter>);
    expect(screen.getByRole('button')).toHaveClass('line-through', 'opacity-60');
  });

  it('leaves other cards alone', () => {
    render(<MemoryRouter><PlannerChip card={card} /></MemoryRouter>);
    expect(screen.getByRole('button')).not.toHaveClass('line-through');
  });
});

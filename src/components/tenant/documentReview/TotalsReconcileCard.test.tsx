import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TotalsReconcileCard } from './TotalsReconcileCard';
import type { HandoffLine } from '@/lib/salesOrderDocumentHandoff';

const lines = [
  { id: 'a', lineNo: 1, docAmount: 100 }, { id: 'b', lineNo: 2, docAmount: 200 },
] as HandoffLine[];

describe('TotalsReconcileCard', () => {
  it('shows a match when totals agree', () => {
    render(<TotalsReconcileCard docTotal={300} formTotal={300} lines={lines} formAmounts={new Map([['a', 100], ['b', 200]])} />);
    expect(screen.getByText('Matches the document')).toBeInTheDocument();
  });

  it('shows Off by $X and the line to check', () => {
    render(<TotalsReconcileCard docTotal={300} formTotal={312.4} lines={lines} formAmounts={new Map([['a', 100], ['b', 212.4]])} />);
    expect(screen.getByText(/Off by \$12\.40/)).toHaveTextContent('Off by $12.40 — check line 2');
  });

  it('explains a missing document total', () => {
    render(<TotalsReconcileCard docTotal={null} formTotal={50} lines={lines} formAmounts={new Map()} />);
    expect(screen.getByText(/can't be checked/)).toBeInTheDocument();
  });
});

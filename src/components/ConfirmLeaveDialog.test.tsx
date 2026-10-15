import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmLeaveDialog } from './ConfirmLeaveDialog';

describe('ConfirmLeaveDialog discard-document copy', () => {
  it.each([
    { recordNoun: 'purchase order', want: 'No purchase order is created.' },
    { recordNoun: 'vendor bill', want: 'No vendor bill is created.' },
    { recordNoun: 'sales order', want: 'No sales order is created.' },
    { recordNoun: undefined, want: 'No record is created.' },
  ])('names the $recordNoun the page would create', ({ recordNoun, want }) => {
    render(<ConfirmLeaveDialog variant="discard-document" recordNoun={recordNoun} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent(want);
  });

  it('ignores recordNoun on other variants', () => {
    render(<ConfirmLeaveDialog variant="unsaved-changes" recordNoun="vendor bill" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).not.toHaveTextContent('vendor bill');
  });
});

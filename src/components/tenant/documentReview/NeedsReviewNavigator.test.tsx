import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeedsReviewNavigator } from './NeedsReviewNavigator';
import type { ReviewItem } from '@/lib/salesOrderDocumentHandoff';

const pending: ReviewItem[] = [
  { key: 'customer', label: 'Customer', reason: 'x', required: true },
  { key: 'line:1', label: 'Line 1', reason: 'y', required: true },
  { key: 'poNumber', label: 'PO number', reason: 'z', required: false },
];

describe('NeedsReviewNavigator', () => {
  it('shows the count and jumps to the next unresolved field on click', async () => {
    const onJump = vi.fn();
    render(<NeedsReviewNavigator pending={pending} onJump={onJump} />);
    const btn = screen.getByRole('button', { name: /Needs review, 3 remaining/ });
    expect(btn).toHaveTextContent('Needs review (3)');
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(onJump.mock.calls.map((c) => c[0])).toEqual(['customer', 'line:1']);
  });

  it('cycles with Alt+ArrowDown / Alt+ArrowUp, wrapping around', () => {
    const onJump = vi.fn();
    render(<NeedsReviewNavigator pending={pending} onJump={onJump} />);
    fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(document, { key: 'ArrowUp', altKey: true });
    expect(onJump.mock.calls.map((c) => c[0])).toEqual(['customer', 'line:1', 'poNumber', 'customer', 'poNumber']);
  });

  it('ignores arrows without Alt and is disabled when nothing is left', () => {
    const onJump = vi.fn();
    render(<NeedsReviewNavigator pending={[]} onJump={onJump} />);
    fireEvent.keyDown(document, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(onJump).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Needs review, 0 remaining/ })).toBeDisabled();
  });

  it('documents the shortcuts in a popover opened by the ? button', async () => {
    render(<NeedsReviewNavigator pending={pending} onJump={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(await screen.findByText('Review shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Next field to review')).toBeInTheDocument();
  });
});

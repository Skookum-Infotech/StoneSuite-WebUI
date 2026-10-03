import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldProvenance } from './FieldProvenance';

const prov = { source: 'document' as const, confidence: 'check' as const, snippet: 'PO # PO-4471', page: 2, row: 5 };

describe('FieldProvenance', () => {
  it.each([
    ['document', false, 'From document'],
    ['learned', false, 'Learned'],
    ['document', true, 'Needs review'],
  ] as const)('marker text for %s / needsReview=%s is "%s"', (source, needs, text) => {
    render(<FieldProvenance label="PO number" provenance={{ ...prov, source }} needsReview={needs} onShowInDocument={vi.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('opens a focusable popover with snippet, page and confidence words, and shows in document', async () => {
    const onShow = vi.fn();
    render(<FieldProvenance label="PO number" provenance={prov} needsReview={false} onShowInDocument={onShow} />);
    const trigger = screen.getByRole('button', { name: 'Where PO number came from' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('PO # PO-4471')).toBeInTheDocument();
    expect(screen.getByText('Confidence: Check')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show in document' }));
    expect(onShow).toHaveBeenCalledWith(2, 5);
  });

  it('renders no popover trigger without provenance', () => {
    render(<FieldProvenance label="Customer" provenance={undefined} needsReview onShowInDocument={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SegmentedProgressBar } from './SegmentedProgressBar';

function litSegments(container: HTMLElement, fillClass: string): number {
  return container.querySelectorAll(`.${fillClass}`).length;
}

describe('SegmentedProgressBar', () => {
  it('lights segments in orange while partway and shows the percent', () => {
    const { container } = render(<SegmentedProgressBar percent={33} ariaLabel="PO-1 received" />);
    expect(litSegments(container, 'bg-orange-500')).toBe(3);
    expect(container.querySelectorAll('span.h-3\\.5')).toHaveLength(10);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('turns green with every segment lit once complete', () => {
    const { container } = render(<SegmentedProgressBar percent={100} ariaLabel="PO-1 received" />);
    expect(litSegments(container, 'bg-emerald-500')).toBe(10);
    expect(litSegments(container, 'bg-orange-500')).toBe(0);
  });

  it('lights nothing at zero', () => {
    const { container } = render(<SegmentedProgressBar percent={0} ariaLabel="PO-1 received" />);
    expect(litSegments(container, 'bg-orange-500')).toBe(0);
    expect(litSegments(container, 'bg-emerald-500')).toBe(0);
  });

  it('exposes its value to assistive tech', () => {
    render(<SegmentedProgressBar percent={67} ariaLabel="PO-1 received" />);
    const bar = screen.getByRole('progressbar', { name: 'PO-1 received' });
    expect(bar).toHaveAttribute('aria-valuenow', '67');
    expect(bar).toHaveAttribute('aria-valuetext', '67%');
  });

  it('shows a custom value label in place of the percent', () => {
    render(<SegmentedProgressBar percent={67} ariaLabel="Lines received" valueLabel="4 of 6" />);
    expect(screen.getByText('4 of 6')).toBeInTheDocument();
    expect(screen.queryByText('67%')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '4 of 6');
  });
});

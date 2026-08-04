import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoreHint } from './MoreHint';

describe('MoreHint', () => {
  it('renders the count and label when there is overflow', () => {
    render(<MoreHint count={3} label="more open orders" />);
    expect(screen.getByText('+3 more open orders')).toBeInTheDocument();
  });

  it('renders nothing when count is zero', () => {
    const { container } = render(<MoreHint count={0} label="more open orders" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when count is negative', () => {
    const { container } = render(<MoreHint count={-2} label="more open orders" />);
    expect(container).toBeEmptyDOMElement();
  });
});

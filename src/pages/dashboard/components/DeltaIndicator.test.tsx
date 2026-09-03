import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeltaIndicator } from './DeltaIndicator';

describe('DeltaIndicator', () => {
  it('renders a note in the warning tone as plain text with no arrow', () => {
    const { container } = render(<DeltaIndicator variant="note" text="oldest 2 days" tone="warn" />);
    const el = screen.getByText('oldest 2 days');
    expect(el).toHaveClass('text-warning');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a neutral note in the muted tone', () => {
    render(<DeltaIndicator variant="note" text="all caught up" tone="neutral" />);
    expect(screen.getByText('all caught up')).toHaveClass('text-stone-500');
  });

  it('renders an upward trend as a chip with an up arrow', () => {
    const { container } = render(
      <DeltaIndicator variant="trend" text="18%" tone="up" direction="up" />,
    );
    const chip = screen.getByText('18%');
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(chip.closest('span')).toHaveClass('text-brand-dark-hover');
  });

  it('renders a downward trend as a chip with a down arrow', () => {
    const { container } = render(
      <DeltaIndicator variant="trend" text="12%" tone="warn" direction="down" />,
    );
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders a flat trend as a chip with no arrow', () => {
    const { container } = render(
      <DeltaIndicator variant="trend" text="No change this week" tone="neutral" direction="flat" />,
    );
    expect(screen.getByText('No change this week')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });
});

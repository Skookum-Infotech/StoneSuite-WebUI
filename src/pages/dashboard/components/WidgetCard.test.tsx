import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WidgetCard } from './WidgetCard';

describe('WidgetCard', () => {
  it('renders title, subtitle, and children', () => {
    render(
      <WidgetCard title="Pipeline mix" subtitle="50 records">
        <p>content</p>
      </WidgetCard>,
    );
    expect(screen.getByText('Pipeline mix')).toBeInTheDocument();
    expect(screen.getByText('50 records')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('fills the full height of its grid cell so row-mates align', () => {
    render(
      <WidgetCard title="Pipeline mix">
        <p>content</p>
      </WidgetCard>,
    );
    expect(screen.getByText('Pipeline mix').closest('div.flex.h-full.flex-col')).toBeInTheDocument();
  });

  it('omits the subtitle span when none is given', () => {
    render(
      <WidgetCard title="Pipeline mix">
        <p>content</p>
      </WidgetCard>,
    );
    expect(screen.queryByText('50 records')).not.toBeInTheDocument();
  });
});

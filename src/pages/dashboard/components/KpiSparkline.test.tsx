import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { KpiSparkline } from './KpiSparkline';

describe('KpiSparkline', () => {
  it('draws the line, a filled area, and an end-point dot for a series', () => {
    const { container } = render(<KpiSparkline points={[0, 5, 10]} color="#719c3b" />);

    expect(container.querySelector('polyline')?.getAttribute('points')).toBe('0,24 39,13 78,2');
    expect(container.querySelector('path')).not.toBeNull();

    const dot = container.querySelector('circle');
    expect(dot?.getAttribute('cx')).toBe('78');
    expect(dot?.getAttribute('cy')).toBe('2');
    expect(dot?.getAttribute('fill')).toBe('#719c3b');
  });

  it('renders no line or dot for an empty series', () => {
    const { container } = render(<KpiSparkline points={[]} color="#719c3b" />);
    expect(container.querySelector('polyline')?.getAttribute('points') || '').toBe('');
    expect(container.querySelector('circle')).toBeNull();
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<KpiSparkline points={[1, 2, 3]} color="#719c3b" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

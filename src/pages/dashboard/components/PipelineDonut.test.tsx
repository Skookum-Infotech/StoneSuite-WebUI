import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineDonut } from './PipelineDonut';
import type { PipelineMix } from '@/types/dashboardData';

function makeMix(overrides: Partial<PipelineMix> = {}): PipelineMix {
  return {
    range: 'all',
    segments: [
      { id: 'lead', count: 24 },
      { id: 'prospect', count: 17 },
      { id: 'customer', count: 9 },
    ],
    closeRate: 18,
    ...overrides,
  };
}

describe('PipelineDonut', () => {
  it('shows a loading state while the query is in flight', () => {
    render(<PipelineDonut data={undefined} isLoading={true} isError={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Lead')).not.toBeInTheDocument();
  });

  it('shows an error message when the query fails', () => {
    render(<PipelineDonut data={undefined} isLoading={false} isError={true} />);
    expect(screen.getByText(/couldn.?t load/i)).toBeInTheDocument();
  });

  it('renders every granted stage with its label and count', () => {
    render(<PipelineDonut data={makeMix()} isLoading={false} isError={false} />);
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('Prospect')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('shows the total record count as the subtitle', () => {
    render(<PipelineDonut data={makeMix()} isLoading={false} isError={false} />);
    expect(screen.getByText('50 records')).toBeInTheDocument();
  });

  it('displays the server-computed close rate verbatim, without recomputing it', () => {
    render(<PipelineDonut data={makeMix({ closeRate: 42 })} isLoading={false} isError={false} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('omits a stage the caller has no grant on instead of showing it as zero', () => {
    render(
      <PipelineDonut
        data={makeMix({ segments: [{ id: 'lead', count: 24 }, { id: 'prospect', count: 17 }] })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.queryByText('Customer')).not.toBeInTheDocument();
  });
});

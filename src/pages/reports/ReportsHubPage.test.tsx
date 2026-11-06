import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsHubPage from './ReportsHubPage';

// The router registers each hub as a static path (reports/sales), so the page
// gets its module as a prop, not from a URL param.
function renderHub(slug: string): void {
  render(
    <MemoryRouter>
      <ReportsHubPage slug={slug} />
    </MemoryRouter>,
  );
}

describe('ReportsHubPage', () => {
  it('links the built Sales reports to their pages', () => {
    renderHub('sales');
    expect(screen.getByRole('heading', { name: 'Sales Reports' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Sales by Customer' })).toHaveAttribute('href', '/reports/sales/by-customer');
    expect(screen.getByRole('link', { name: 'Open Sales by Item' })).toHaveAttribute('href', '/reports/sales/by-item');
    expect(screen.getByRole('link', { name: 'Open Sales Trend' })).toHaveAttribute('href', '/reports/sales/trend');
  });

  it('lists planned reports as coming soon, not as links', () => {
    renderHub('crm');
    const planned = screen.getByLabelText('Conversion Funnel (coming soon)');
    expect(planned.tagName).toBe('LI');
    expect(screen.queryByRole('link', { name: /Conversion Funnel/ })).not.toBeInTheDocument();
  });

  it('says so for an unknown module', () => {
    renderHub('nope');
    expect(screen.getByText('This report group does not exist.')).toBeInTheDocument();
  });
});

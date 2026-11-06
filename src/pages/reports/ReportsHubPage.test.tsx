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
    renderHub('calendar');
    const planned = screen.getByLabelText('Upcoming Installs (coming soon)');
    expect(planned.tagName).toBe('LI');
    expect(screen.queryByRole('link', { name: /Upcoming Installs/ })).not.toBeInTheDocument();
  });

  it('says so for an unknown module', () => {
    renderHub('nope');
    expect(screen.getByText('This report group does not exist.')).toBeInTheDocument();
  });
});

describe('ReportsHubPage CRM', () => {
  it('links the built CRM reports to their pages', () => {
    renderHub('crm');
    expect(screen.getByRole('link', { name: 'Open Conversion Funnel' })).toHaveAttribute('href', '/reports/crm/funnel');
    expect(screen.getByRole('link', { name: 'Open Lead Source Performance' })).toHaveAttribute('href', '/reports/crm/lead-sources');
    expect(screen.getByRole('link', { name: 'Open Stale Leads & Prospects' })).toHaveAttribute('href', '/reports/crm/stale');
  });
});

describe('ReportsHubPage Purchases', () => {
  it('links all four built Purchases reports', () => {
    renderHub('purchases');
    expect(screen.getByRole('link', { name: 'Open Purchases by Vendor' })).toHaveAttribute('href', '/reports/purchases/by-vendor');
    expect(screen.getByRole('link', { name: 'Open Purchases by Item' })).toHaveAttribute('href', '/reports/purchases/by-item');
    expect(screen.getByRole('link', { name: 'Open Open POs & Receiving' })).toHaveAttribute('href', '/reports/purchases/open-pos');
    expect(screen.getByRole('link', { name: 'Open AP Aging' })).toHaveAttribute('href', '/reports/purchases/ap-aging');
  });
});

describe('ReportsHubPage Inventory', () => {
  it('links all four built Inventory reports', () => {
    renderHub('inventory');
    expect(screen.getByRole('link', { name: 'Open Stock on Hand & Valuation' })).toHaveAttribute('href', '/reports/inventory/stock');
    expect(screen.getByRole('link', { name: 'Open Slab Availability' })).toHaveAttribute('href', '/reports/inventory/slabs');
    expect(screen.getByRole('link', { name: 'Open Low Stock' })).toHaveAttribute('href', '/reports/inventory/low-stock');
    expect(screen.getByRole('link', { name: 'Open Stock Movement' })).toHaveAttribute('href', '/reports/inventory/movement');
  });
});

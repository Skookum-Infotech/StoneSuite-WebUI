import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as Registry from '@/lib/reportsRegistry';
import ReportsHubPage from './ReportsHubPage';

// Every real module is fully built now, so one fake module with a planned report
// stands in for the "coming soon" card.
vi.mock('@/lib/reportsRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof Registry>();
  return {
    ...actual,
    findReportModule: (slug: string | undefined) =>
      slug === 'planned-demo'
        ? {
            slug: 'planned-demo',
            label: 'Demo',
            description: 'A module with a report still planned.',
            resource: 'report_demo',
            reports: [{ id: 'later', title: 'Future Report', description: 'Not built yet.' }],
          }
        : actual.findReportModule(slug),
  };
});

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
    renderHub('planned-demo');
    const planned = screen.getByLabelText('Future Report (coming soon)');
    expect(planned.tagName).toBe('LI');
    expect(screen.queryByRole('link', { name: /Future Report/ })).not.toBeInTheDocument();
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

describe('ReportsHubPage Calendar', () => {
  it('links all four built Calendar reports', () => {
    renderHub('calendar');
    expect(screen.getByRole('link', { name: 'Open Upcoming Installs' })).toHaveAttribute('href', '/reports/calendar/upcoming-installs');
    expect(screen.getByRole('link', { name: 'Open Overdue Activities' })).toHaveAttribute('href', '/reports/calendar/overdue');
    expect(screen.getByRole('link', { name: 'Open On-time Completion' })).toHaveAttribute('href', '/reports/calendar/on-time');
    expect(screen.getByRole('link', { name: 'Open Order-to-Install Lead Time' })).toHaveAttribute('href', '/reports/calendar/lead-time');
  });
});

describe('ReportsHubPage Finance', () => {
  it('links the Profit & Loss report', () => {
    renderHub('finance');
    expect(screen.getByRole('link', { name: 'Open Profit & Loss' })).toHaveAttribute('href', '/reports/finance/profit-loss');
  });
});

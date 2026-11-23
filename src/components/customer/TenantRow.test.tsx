import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({
  platformService: { lifecycle: vi.fn(), purgeTenant: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TenantRow } from './TenantRow';
import type { Tenant } from '@/types/tenant';

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't-1',
    slug: 'acme',
    displayName: 'Acme Stone Co.',
    status: 'active',
    migrationStatus: 'migrated',
    dbName: 'tenant_acme',
    r2Bucket: 'ss-acme',
    isPlatformOwner: false,
    createdAt: '2026-01-15T00:00:00Z',
    metadata: { super_admin_email: 'owner@acme.test', phone: '+1 555 0100' },
    ...overrides,
  };
}

function renderRow(tenant: Tenant) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <TenantRow tenant={tenant} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('TenantRow', () => {
  it('links to the dedicated details page instead of expanding in place', () => {
    renderRow(makeTenant());

    const link = screen.getByRole('link', { name: 'View details for Acme Stone Co.' });
    expect(link).toHaveAttribute('href', '/customer/onboarding/t-1');
    expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { expanded: true })).not.toBeInTheDocument();
  });

  it('summarises the customer: name, status, slug and contact details', () => {
    renderRow(makeTenant());

    const link = screen.getByRole('link', { name: 'View details for Acme Stone Co.' });
    expect(link).toHaveTextContent('Acme Stone Co.');
    expect(link).toHaveTextContent('active');
    expect(link).toHaveTextContent('db migrated');
    expect(link).toHaveTextContent('acme');
    expect(link).toHaveTextContent('owner@acme.test');
    expect(link).toHaveTextContent('+1 555 0100');
  });

  it('shows the lifecycle buttons beside the link, never nested inside it', () => {
    renderRow(makeTenant());

    const suspend = screen.getByRole('button', { name: 'Suspend Acme Stone Co.' });
    expect(suspend.closest('a')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Acme Stone Co. permanently' }).closest('a')).toBeNull();
  });

  it('marks the platform owner and offers it no destructive buttons', () => {
    renderRow(makeTenant({ isPlatformOwner: true }));

    expect(screen.getByText('Platform owner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspend|delete/i })).not.toBeInTheDocument();
  });
});

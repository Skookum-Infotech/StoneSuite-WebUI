import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './DashboardPage';
import { useAuthStore } from '@/store/useAuthStore';
import { WIDGET_CATALOG } from '@/config/dashboardWidgets';
import { dashboardWidgetService } from '@/services/dashboardWidgetService';

vi.mock('@/services/dashboardWidgetService', () => ({
  dashboardWidgetService: {
    getCatalog: vi.fn(),
    getMyAllocation: vi.fn(),
    getPreference: vi.fn(),
    setPreference: vi.fn(),
  },
}));
// Widget data never resolves: these tests only care about the page shell.
vi.mock('@/services/dashboardDataService', () => ({
  dashboardDataService: new Proxy({}, { get: () => () => new Promise(() => {}) }),
}));

const widgets = vi.mocked(dashboardWidgetService);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe('DashboardPage loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'u1' } as never });
    widgets.getCatalog.mockResolvedValue(WIDGET_CATALOG);
    widgets.getMyAllocation.mockResolvedValue([]);
    widgets.getPreference.mockResolvedValue({ userId: 'u1', hidden: [] });
  });

  it('stops loading when the preference fails to load', async () => {
    widgets.getPreference.mockRejectedValue(new Error('500'));
    renderPage();
    expect(await screen.findByText(/allocate dashboard widgets/i)).toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard…')).not.toBeInTheDocument();
  });

  it('stops loading when there is no signed-in user to load a preference for', async () => {
    useAuthStore.setState({ user: null });
    renderPage();
    expect(await screen.findByText(/allocate dashboard widgets/i)).toBeInTheDocument();
  });

  it('shows a retry when the catalog or allocation fails', async () => {
    widgets.getMyAllocation.mockRejectedValue(new Error('500'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your dashboard/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText('Loading dashboard…')).not.toBeInTheDocument();
  });
});

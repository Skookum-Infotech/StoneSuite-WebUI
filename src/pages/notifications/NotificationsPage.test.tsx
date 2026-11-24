import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import NotificationsPage from './NotificationsPage';
import { notificationService } from '@/services/notificationService';
import type { AppNotification, NotificationHistoryPage } from '@/types/notification';

vi.mock('@/services/notificationService', () => ({
  notificationService: { history: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));

const historyMock = vi.mocked(notificationService.history);
const markReadMock = vi.mocked(notificationService.markRead);
const markAllReadMock = vi.mocked(notificationService.markAllRead);

function note(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1', tenantId: 't', recipientUserId: 'u', eventType: 'automation.vendor_bill_due',
    resource: 'vendor_bill', resourceId: 'bill-1', title: 'Vendor bill due tomorrow',
    body: 'VB-7 from Granite Co is due tomorrow.', link: '/purchases/vendor_bill/bill-1',
    visibleInApp: true, createdAt: '2026-11-24T15:05:00Z', ...over,
  };
}

function page(items: AppNotification[], totalPages = 1): NotificationHistoryPage {
  return { notifications: items, pagination: { page: 1, pageSize: 20, total: items.length, totalPages } };
}

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationsPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    historyMock.mockReset();
    markReadMock.mockReset().mockResolvedValue(undefined);
    markAllReadMock.mockReset().mockResolvedValue(undefined);
  });

  it('shows title, message, related record, time and read state', async () => {
    historyMock.mockResolvedValue(page([note(), note({ id: 'n2', title: 'Old news', body: 'Older message.', readAt: '2026-11-24T16:00:00Z', resource: 'sales_order' })]));
    renderPage();

    expect(await screen.findByText('Vendor bill due tomorrow')).toBeInTheDocument();
    expect(screen.getByText('VB-7 from Granite Co is due tomorrow.')).toBeInTheDocument();
    expect(screen.getByText('Vendor bill')).toBeInTheDocument();
    expect(screen.getByText('Sales order')).toBeInTheDocument();
    expect(screen.getAllByRole('time')[0]).toHaveAttribute('datetime', '2026-11-24T15:05:00Z');
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'Read' })).toHaveLength(1);
  });

  it('opens the related record and marks the notification read', async () => {
    historyMock.mockResolvedValue(page([note()]));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Vendor bill due tomorrow' }));

    expect(markReadMock).toHaveBeenCalledWith('n1');
    expect(screen.getByTestId('where')).toHaveTextContent('/purchases/vendor_bill/bill-1');
  });

  it('does not re-mark an already read notification when opened', async () => {
    historyMock.mockResolvedValue(page([note({ readAt: '2026-11-24T16:00:00Z' })]));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Vendor bill due tomorrow' }));

    expect(markReadMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Mark .* as read/ })).not.toBeInTheDocument();
  });

  it('marks one and all as read', async () => {
    historyMock.mockResolvedValue(page([note()]));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Vendor bill due tomorrow as read' }));
    expect(markReadMock).toHaveBeenCalledWith('n1');

    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(markAllReadMock).toHaveBeenCalled();
  });

  it('filters to unread and starts again from page one', async () => {
    historyMock.mockResolvedValue(page([note()], 3));
    renderPage();
    await screen.findByText('Page 1 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(historyMock).toHaveBeenLastCalledWith(2, 20, false));

    await userEvent.click(screen.getByRole('tab', { name: 'Unread' }));
    await waitFor(() => expect(historyMock).toHaveBeenLastCalledWith(1, 20, true));
  });

  it('says so when there is nothing', async () => {
    historyMock.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    historyMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page([note()]));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Vendor bill due tomorrow')).toBeInTheDocument();
  });
});

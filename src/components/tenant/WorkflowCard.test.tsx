import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowCard } from './WorkflowCard';
import type { WorkflowBlock } from '@/types/workflow';
import { salesOrderService } from '@/services/salesOrderService';
import type { SalesOrder } from '@/types/salesOrder';

vi.mock('@/services/salesOrderService', () => ({ salesOrderService: { getOrder: vi.fn() } }));

function withClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
}

const workflow: WorkflowBlock = {
  stages: [
    { key: 'requisition', records: [{ id: 'r1', number: 'REQ-0014', statusCode: 'APPV', status: 'Approved' }] },
    { key: 'purchaseOrder', records: [{ id: 'p1', number: 'PORD-000021', statusCode: 'SENT', status: 'Sent' }] },
    { key: 'receiving', records: [] },
    { key: 'vendorBill', records: [] },
    { key: 'vendorPayment', records: [] },
  ],
};

function renderCard(wf?: WorkflowBlock) {
  return render(withClient(<WorkflowCard module="purchaseOrder" statusCode="SENT" statusLabel="Sent to Vendor" workflow={wf} />));
}

describe('WorkflowCard', () => {
  it('shows the five purchase stages with the current one marked', () => {
    renderCard(workflow);
    expect(screen.getByRole('list', { name: 'Progress Bar' })).toBeInTheDocument();
    expect(screen.getByText('Stage 2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Requisition/ })).toHaveTextContent('REQ-0014 · Approved');
    expect(screen.getByText('Sent to Vendor').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByText('Not started')).toHaveLength(3);
  });

  it('links a completed stage to its record', () => {
    renderCard(workflow);
    expect(screen.getByRole('link', { name: /Requisition/ })).toHaveAttribute('href', '/purchases/requisition/r1');
  });

  it("lists the current record's sub-statuses in the hover panel", () => {
    renderCard(workflow);
    const panel = within(screen.getAllByRole('tooltip')[1]);
    expect(panel.getByText('Partially Received')).toBeInTheDocument();
    expect(panel.getByText(/Sent/)).toBeInTheDocument();
  });

  it('shows the other stages as "Not linked" without a workflow block', () => {
    renderCard(undefined);
    expect(screen.getByText('Sent to Vendor')).toBeInTheDocument();
    expect(screen.getAllByText('Not linked')).toHaveLength(4);
  });

  it('shows the source sales order on an invoice even when the server sent no workflow block', async () => {
    vi.mocked(salesOrderService.getOrder).mockResolvedValue(
      { id: 'so-1', salesOrderNumber: 'SO-0042', statusCode: 'APPV', status: 'Approved' } as SalesOrder,
    );
    render(withClient(<WorkflowCard module="invoice" statusCode="SENT" statusLabel="Sent" links={{ salesOrderId: 'so-1' }} />));
    const link = await screen.findByRole('link', { name: /Sales order/ });
    expect(link).toHaveAttribute('href', '/sales/sales_order/so-1');
    expect(link).toHaveTextContent('SO-0042');
  });

  it("colours the current status below the stage name with that status's pill colour", () => {
    render(withClient(<WorkflowCard module="invoice" statusCode="SENT" statusLabel="Sent" />));
    const status = within(screen.getByRole('listitem', { current: 'step' })).getAllByText('Sent')[0];
    expect(status.style.color).not.toBe('');
  });
});

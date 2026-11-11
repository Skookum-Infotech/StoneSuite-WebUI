import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowCard } from './WorkflowCard';
import type { WorkflowBlock } from '@/types/workflow';
import { salesOrderService } from '@/services/salesOrderService';
import type { SalesOrder } from '@/types/salesOrder';

import { purchaseOrderService } from '@/services/purchaseOrderService';
import { itemReceiptService } from '@/services/itemReceiptService';
import type { PurchaseOrder } from '@/types/purchaseOrder';
import type { ItemReceipt } from '@/types/itemReceipt';

vi.mock('@/services/salesOrderService', () => ({ salesOrderService: { getOrder: vi.fn() } }));
vi.mock('@/services/purchaseOrderService', () => ({ purchaseOrderService: { getPurchaseOrder: vi.fn() } }));
vi.mock('@/services/itemReceiptService', () => ({ itemReceiptService: { forPurchaseOrder: vi.fn() } }));

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
    expect(screen.getByRole('button', { name: /Requisition/ })).toHaveTextContent('REQ-0014 · Approved');
    expect(screen.getByText('Sent to Vendor').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByText('Not started')).toHaveLength(3);
  });

  it('pulses only the current stage, as a decorative ring', () => {
    renderCard(workflow);
    const rings = screen.getAllByTestId('stage-pulse');
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveAttribute('aria-hidden', 'true');
    expect(rings[0].closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('opens one pinned panel at a time and locks the other stages until it closes', async () => {
    const user = userEvent.setup();
    renderCard(workflow);
    const req = screen.getByRole('button', { name: /Requisition/ });
    const po = screen.getByRole('button', { name: /Purchase order/ });
    await user.click(req);
    expect(req).toHaveAttribute('aria-expanded', 'true');
    await user.click(po);
    expect(po).toHaveAttribute('aria-expanded', 'false');
    expect(req).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(req).toHaveAttribute('aria-expanded', 'false');
    await user.click(po);
    expect(po).toHaveAttribute('aria-expanded', 'true');
    await user.click(document.body);
    expect(po).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands the hidden steps in place instead of navigating', async () => {
    const user = userEvent.setup();
    render(withClient(<WorkflowCard module="fabrication" statusCode="ORCV" statusLabel="Order Received" />));
    await user.click(screen.getByRole('button', { name: /Fabrication/ }));
    await user.click(screen.getByRole('button', { name: /3 more steps/ }));
    expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument();
    expect(screen.queryByText(/more steps/)).not.toBeInTheDocument();
  });

  it("lists the current record's sub-statuses in the panel", () => {
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
    const link = await screen.findByRole('button', { name: /Sales order/ });
    expect(link).toHaveTextContent('SO-0042');
  });

  it('shows the source purchase order on an item receipt even when the server sent no workflow block', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(
      { id: 'po-1', purchaseOrderNumber: 'PORD-000020', statusCode: 'PART', status: 'Partially Received' } as PurchaseOrder,
    );
    vi.mocked(itemReceiptService.forPurchaseOrder).mockResolvedValue([
      { id: 'ir-1', itemReceiptNumber: 'IRCT-000034', statusCode: 'PART', status: 'Partial' } as ItemReceipt,
    ]);
    render(withClient(<WorkflowCard module="itemReceipt" statusCode="PART" statusLabel="Partial" links={{ purchaseOrderId: 'po-1' }} />));
    const link = await screen.findByRole('button', { name: /Purchase order/ });
    expect(link).toHaveTextContent('PORD-000020');
  });

  it('shows the receipt on a purchase order once one is created', async () => {
    vi.mocked(itemReceiptService.forPurchaseOrder).mockResolvedValue([
      { id: 'ir-1', itemReceiptNumber: 'IRCT-000034', statusCode: 'PART', status: 'Partial' } as ItemReceipt,
    ]);
    render(withClient(<WorkflowCard module="purchaseOrder" statusCode="PART" statusLabel="Partially Received" links={{ purchaseOrderId: 'po-1' }} />));
    const link = await screen.findByRole('button', { name: /Receiving/ });
  });

  it("colours the current status below the stage name with that status's pill colour", () => {
    render(withClient(<WorkflowCard module="invoice" statusCode="SENT" statusLabel="Sent" />));
    const status = within(screen.getByRole('listitem', { current: 'step' })).getAllByText('Sent')[0];
    expect(status.style.color).not.toBe('');
  });
});

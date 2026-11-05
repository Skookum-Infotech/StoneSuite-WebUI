import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkflowCard } from './WorkflowCard';
import type { WorkflowBlock } from '@/types/workflow';

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
  return render(
    <MemoryRouter>
        <WorkflowCard module="purchaseOrder" statusCode="SENT" statusLabel="Sent to Vendor" workflow={wf} />
    </MemoryRouter>,
  );
}

describe('WorkflowCard', () => {
  it('shows the five purchase stages with the current one marked', () => {
    renderCard(workflow);
    expect(screen.getByRole('list', { name: 'Progress Bar' })).toBeInTheDocument();
    expect(screen.getByText('Stage 2 of 5')).toBeInTheDocument();
    expect(screen.getByText('REQ-0014 · Approved')).toBeInTheDocument();
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
});

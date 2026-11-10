import { describe, expect, it } from 'vitest';
import { buildPanelSteps, buildWorkflowStages, onlyLinkedStages } from './workflowStages';
import type { WorkflowBlock, WorkflowRecordRef } from '@/types/workflow';

const rec = (number: string, statusCode: string, status: string): WorkflowRecordRef => ({ id: number, number, statusCode, status });

const salesBlock: WorkflowBlock = {
  stages: [
    { key: 'quote', records: [rec('QT-1', 'SENT', 'Sent')] },
    { key: 'salesOrder', records: [rec('SO-1', 'PART', 'Partially Filled')] },
    { key: 'fabrication', records: [rec('FJ-1', 'CUTG', 'Cutting')] },
    { key: 'invoice', records: [rec('INV-1', 'SENT', 'Sent')] },
    { key: 'payment', records: [] },
    { key: 'refund', records: [] },
  ],
};

describe('buildWorkflowStages', () => {
  it('marks done, here, in-progress and not-started stages for a sales order', () => {
    const view = buildWorkflowStages('salesOrder', 'Partially Filled', salesBlock)!;
    expect(view.stages.map((s) => s.state)).toEqual(['done', 'here', 'progress', 'upcoming', 'progress', 'upcoming', 'upcoming']);
    expect(view.hereIndex).toBe(1);
    expect(view.stages[0].subtitle).toBe('QT-1 · Sent');
    expect(view.stages[1].subtitle).toBe('Partially Filled');
    expect(view.stages[5].subtitle).toBe('Not started');
    expect(view.stages[6].subtitle).toBe('No refund');
  });

  it('places an item receipt on the Receiving stage of the purchase flow', () => {
    const view = buildWorkflowStages('itemReceipt', 'Partial', { stages: [] })!;
    expect(view.hereIndex).toBe(2);
    expect(view.stages[2].key).toBe('receiving');
  });

  it('shows "Not linked" for a stage the server did not send, and a count for several records', () => {
    const view = buildWorkflowStages('invoice', 'Sent', {
      stages: [{ key: 'payment', records: [rec('P-1', 'APPV', 'Approved'), rec('P-2', 'DEPO', 'Deposited')] }],
    })!;
    expect(view.stages[0].subtitle).toBe('Not linked');
    expect(view.stages[5].subtitle).toBe('2 records');
  });

  it('flags a stage holding a cancelled or void record', () => {
    const view = buildWorkflowStages('salesOrder', 'Open', {
      stages: [{ key: 'invoice', records: [rec('INV-1', 'VOID', 'Void')] }],
    })!;
    expect(view.stages[4].state).toBe('void');
  });

  it('marks a stage done only when every record is at its final step', () => {
    const view = buildWorkflowStages('salesOrder', 'Open', {
      stages: [{ key: 'invoice', records: [rec('INV-1', 'PAID', 'Paid'), rec('INV-2', 'SENT', 'Sent')] }],
    })!;
    expect(view.stages[4].state).toBe('progress');
  });

  it('splits a fabrication job into Fabrication and Installation at the handoff to shipping', () => {
    const at = (code: string, label: string) => buildWorkflowStages('salesOrder', 'Open', {
      stages: [{ key: 'fabrication', records: [rec('FJ-1', code, label)] }],
    })!.stages.slice(2, 4).map((s) => s.state);
    expect(at('CUTG', 'Cutting')).toEqual(['progress', 'upcoming']);
    expect(at('RSHP', 'Ready for Shipping')).toEqual(['done', 'upcoming']);
    expect(at('INST', 'Installing')).toEqual(['done', 'progress']);
    expect(at('COMP', 'Completed')).toEqual(['done', 'done']);
  });

  it('puts a fabrication job on Installation once it is in transit', () => {
    expect(buildWorkflowStages('fabrication', 'In Transit', { stages: [] }, 'TRAN')!.stages[3].state).toBe('here');
    expect(buildWorkflowStages('fabrication', 'Cutting', { stages: [] }, 'CUTG')!.stages[2].state).toBe('here');
  });

  it('gives every started stage its own palette and leaves unstarted ones uncoloured', () => {
    const view = buildWorkflowStages('salesOrder', 'Partially Filled', salesBlock, 'PART')!;
    expect(view.stages.slice(0, 5).map((x) => x.color?.ring)).toEqual(['#a855f7', '#99c466', '#f59e0b', undefined, '#3b82f6']);
    expect(view.stages[5].color).toBeUndefined();
  });

  it('marks the viewed record complete only at its last status', () => {
    expect(buildWorkflowStages('refund', 'Sent', { stages: [] }, 'SENT')!.stages[6].complete).toBe(true);
    expect(buildWorkflowStages('refund', 'Pending', { stages: [] }, 'PEND')!.stages[6].complete).toBe(false);
  });

  it('places a refund on the last stage of the sales flow', () => {
    const view = buildWorkflowStages('refund', 'Pending', { stages: [] }, 'PEND')!;
    expect(view.hereIndex).toBe(6);
  });

  it('returns null for a document outside both flows', () => {
    expect(buildWorkflowStages('expense', 'Draft', { stages: [] })).toBeNull();
  });
});

describe('onlyLinkedStages', () => {
  const keys = (block: WorkflowBlock, module: Parameters<typeof buildWorkflowStages>[0], label: string, code?: string) =>
    onlyLinkedStages(buildWorkflowStages(module, label, block, code)!).stages.map((s) => s.key);

  it('keeps only the stages the customer has records for, plus the page itself', () => {
    expect(keys({ stages: [
      { key: 'quote', records: [rec('QT-1', 'SENT', 'Sent')] },
      { key: 'invoice', records: [rec('INV-1', 'SENT', 'Sent')] },
    ] }, 'salesOrder', 'Open')).toEqual(['quote', 'salesOrder', 'invoice']);
  });

  it('drops every empty stage when nothing else is linked', () => {
    expect(keys({ stages: [] }, 'itemReceipt', 'Partial')).toEqual(['receiving']);
  });

  it('keeps a purchase flow that skipped Receiving as Requisition, PO, Bill, Payment', () => {
    expect(keys({ stages: [
      { key: 'requisition', records: [rec('R-1', 'APPV', 'Approved')] },
      { key: 'purchaseOrder', records: [rec('PO-1', 'SENT', 'Sent')] },
      { key: 'vendorPayment', records: [rec('VP-1', 'SENT', 'Sent')] },
    ] }, 'vendorBill', 'Paid')).toEqual(['requisition', 'purchaseOrder', 'vendorBill', 'vendorPayment']);
  });

  it('hides Installation until a fabrication job has been handed to shipping', () => {
    const block: WorkflowBlock = { stages: [{ key: 'fabrication', records: [rec('FJ-1', 'CUTG', 'Cutting')] }] };
    expect(keys(block, 'salesOrder', 'Open')).toEqual(['salesOrder', 'fabrication']);
  });

  it('keeps a stage with void records and one whose records the caller may not see', () => {
    expect(keys({ stages: [
      { key: 'invoice', records: [rec('INV-1', 'VOID', 'Void')] },
      { key: 'payment', records: [], hidden: true },
    ] }, 'salesOrder', 'Open')).toEqual(['salesOrder', 'invoice', 'payment']);
  });

  it('recomputes where the page sits', () => {
    const view = onlyLinkedStages(buildWorkflowStages('invoice', 'Sent', { stages: [{ key: 'quote', records: [rec('QT-1', 'SENT', 'Sent')] }] })!);
    expect(view.stages.map((s) => s.key)).toEqual(['quote', 'invoice']);
    expect(view.hereIndex).toBe(1);
  });
});

describe('buildPanelSteps', () => {
  it('cuts the 14-step fabrication path to a window that includes the current step', () => {
    const { steps, hiddenCount } = buildPanelSteps('fabrication', 'CUTG');
    expect(steps).toHaveLength(9);
    expect(hiddenCount).toBe(5);
    expect(steps.find((s) => s.state === 'current')?.label).toBe('Cutting');
  });

  it('lists only the installation part of the fabrication path', () => {
    const { steps } = buildPanelSteps('fabrication', 'INST', { start: 'TRAN', end: 'COMP' });
    expect(steps.map((x) => x.label)).toEqual(['In Transit', 'Installing', 'Completed']);
  });

  it('shows a short path in full', () => {
    const { steps, hiddenCount } = buildPanelSteps('purchaseOrder', 'SENT');
    expect(steps).toHaveLength(7);
    expect(hiddenCount).toBe(0);
  });
});

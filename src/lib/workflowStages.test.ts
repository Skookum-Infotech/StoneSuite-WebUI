import { describe, expect, it } from 'vitest';
import { buildPanelSteps, buildWorkflowStages } from './workflowStages';
import type { WorkflowBlock, WorkflowRecordRef } from '@/types/workflow';

const rec = (number: string, statusCode: string, status: string): WorkflowRecordRef => ({ id: number, number, statusCode, status });

const salesBlock: WorkflowBlock = {
  stages: [
    { key: 'quote', records: [rec('QT-1', 'SENT', 'Sent')] },
    { key: 'salesOrder', records: [rec('SO-1', 'PART', 'Partially Filled')] },
    { key: 'fabrication', records: [rec('FJ-1', 'CUTG', 'Cutting')] },
    { key: 'invoice', records: [rec('INV-1', 'SENT', 'Sent')] },
    { key: 'payment', records: [] },
  ],
};

describe('buildWorkflowStages', () => {
  it('marks done, here, in-progress and not-started stages for a sales order', () => {
    const view = buildWorkflowStages('salesOrder', 'Partially Filled', salesBlock)!;
    expect(view.stages.map((s) => s.state)).toEqual(['done', 'here', 'progress', 'progress', 'upcoming']);
    expect(view.hereIndex).toBe(1);
    expect(view.stages[0].subtitle).toBe('QT-1 · Sent');
    expect(view.stages[1].subtitle).toBe('Partially Filled');
    expect(view.stages[4].subtitle).toBe('Not started');
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
    expect(view.stages[4].subtitle).toBe('2 records');
  });

  it('flags a stage holding a cancelled or void record', () => {
    const view = buildWorkflowStages('salesOrder', 'Open', {
      stages: [{ key: 'invoice', records: [rec('INV-1', 'VOID', 'Void')] }],
    })!;
    expect(view.stages[3].state).toBe('void');
  });

  it('marks a stage done only when every record is at its final step', () => {
    const view = buildWorkflowStages('salesOrder', 'Open', {
      stages: [{ key: 'invoice', records: [rec('INV-1', 'PAID', 'Paid'), rec('INV-2', 'SENT', 'Sent')] }],
    })!;
    expect(view.stages[3].state).toBe('progress');
  });

  it('returns null for a document outside both flows', () => {
    expect(buildWorkflowStages('expense', 'Draft', { stages: [] })).toBeNull();
  });
});

describe('buildPanelSteps', () => {
  it('cuts the 14-step fabrication path to a window that includes the current step', () => {
    const { steps, hiddenCount } = buildPanelSteps('fabrication', 'CUTG');
    expect(steps).toHaveLength(9);
    expect(hiddenCount).toBe(5);
    expect(steps.find((s) => s.state === 'current')?.label).toBe('Cutting');
  });

  it('shows a short path in full', () => {
    const { steps, hiddenCount } = buildPanelSteps('purchaseOrder', 'SENT');
    expect(steps).toHaveLength(7);
    expect(hiddenCount).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { PO_STATUS_CODES } from './purchaseOrderForm';
import { SO_STATUS_CODES } from './salesOrderForm';
import { attachStepHistory, buildProgressSteps, PROGRESS_PATHS } from './orderProgress';

const states = (steps: { state: string }[]) => steps.map((s) => s.state);
const buildSalesOrderProgress = (code: string) => buildProgressSteps(PROGRESS_PATHS.salesOrder, SO_STATUS_CODES, code);
const buildPurchaseOrderProgress = (code: string) => buildProgressSteps(PROGRESS_PATHS.purchaseOrder, PO_STATUS_CODES, code);

describe('sales order progress', () => {
  it.each([
    ['DRFT', ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']],
    ['APPV', ['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming']],
    ['FILL', ['done', 'done', 'done', 'done', 'done', 'current']],
    ['CANC', ['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']],
  ])('status %s', (code, expected) => {
    expect(states(buildSalesOrderProgress(code))).toEqual(expected);
  });

  it('uses catalog labels', () => {
    expect(buildSalesOrderProgress('DRFT').map((s) => s.label)).toContain('Partially Filled');
  });
});

describe('purchase order progress', () => {
  it('marks Sent current with earlier steps done', () => {
    const steps = buildPurchaseOrderProgress('SENT');
    expect(states(steps)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    expect(steps[4].label).toBe('Partially Received');
  });

  it('leaves everything upcoming for an unknown code', () => {
    expect(states(buildPurchaseOrderProgress('XXXX')).every((s) => s === 'upcoming')).toBe(true);
  });
});

describe('buildProgressSteps aliases', () => {
  it('puts an overdue invoice on the Sent step', () => {
    const steps = buildProgressSteps(PROGRESS_PATHS.invoice, [], 'ODUE', { ODUE: 'SENT' });
    expect(states(steps)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming']);
  });
});

describe('attachStepHistory', () => {
  const steps = buildPurchaseOrderProgress('APPV');

  it('stamps reached steps from the audit trail and skips upcoming ones', () => {
    const out = attachStepHistory(steps, [
      { action: 'create', actorName: 'Akhila', at: '2026-10-29T09:00:00Z', newValue: { status_code: 'DRFT' } },
      { action: 'update', actorName: 'Ravi', at: '2026-10-29T11:00:00Z', newValue: { status_code: 'APPV' } },
    ]);
    expect(out[0]).toMatchObject({ actor: 'Akhila', at: '2026-10-29T09:00:00Z' });
    expect(out[2]).toMatchObject({ actor: 'Ravi' });
    expect(out[3].at).toBeUndefined();
  });

  it('falls back to the create entry for the first step and ignores approval_status', () => {
    const out = attachStepHistory(steps, [
      { action: 'create', actorName: 'Akhila', at: '2026-10-29T09:00:00Z' },
      { action: 'update', actorName: 'X', at: '2026-10-29T10:00:00Z', newValue: { approval_status: 'APPV' } },
    ]);
    expect(out[0].actor).toBe('Akhila');
    expect(out[2].at).toBeUndefined();
  });
});

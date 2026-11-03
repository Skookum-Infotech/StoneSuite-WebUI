import { describe, expect, it } from 'vitest';
import { buildPurchaseOrderProgress, buildSalesOrderProgress } from './orderProgress';

const states = (steps: { state: string }[]) => steps.map((s) => s.state);

describe('buildSalesOrderProgress', () => {
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

describe('buildPurchaseOrderProgress', () => {
  it('marks Sent current with earlier steps done', () => {
    const steps = buildPurchaseOrderProgress('SENT');
    expect(states(steps)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    expect(steps[4].label).toBe('Partially Received');
  });

  it('leaves everything upcoming for an unknown code', () => {
    expect(states(buildPurchaseOrderProgress('XXXX')).every((s) => s === 'upcoming')).toBe(true);
  });
});

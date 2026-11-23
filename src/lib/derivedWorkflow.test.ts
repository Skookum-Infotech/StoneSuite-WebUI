import { describe, expect, it } from 'vitest';
import { mergeWorkflow } from './derivedWorkflow';
import type { WorkflowRecordRef } from '@/types/workflow';

const so: WorkflowRecordRef = { id: 'so-1', number: 'SO-1', statusCode: 'APPV', status: 'Approved' };
const inv: WorkflowRecordRef = { id: 'inv-1', number: 'INV-1', statusCode: 'SENT', status: 'Sent' };

describe('mergeWorkflow', () => {
  it('uses derived records when the server sent no block', () => {
    expect(mergeWorkflow(undefined, { salesOrder: so }).stages).toEqual([{ key: 'salesOrder', records: [so] }]);
  });

  it('fills a stage the server left empty', () => {
    const merged = mergeWorkflow({ stages: [{ key: 'salesOrder', records: [] }] }, { salesOrder: so });
    expect(merged.stages[0].records).toEqual([so]);
  });

  it('keeps every record when a stage resolved several (partial receipts)', () => {
    const second = { ...inv, id: 'inv-2', number: 'INV-2' };
    expect(mergeWorkflow(undefined, { invoice: [inv, second] }).stages[0].records).toEqual([inv, second]);
  });

  it('drops a stage whose derived list is empty', () => {
    expect(mergeWorkflow(undefined, { invoice: [] }).stages).toEqual([]);
  });

  it('keeps the server records when it filled the stage', () => {
    const server = { stages: [{ key: 'salesOrder' as const, records: [{ ...so, number: 'SO-SERVER' }] }] };
    expect(mergeWorkflow(server, { salesOrder: so, invoice: inv }).stages.map((s) => s.records[0].number)).toEqual(['SO-SERVER', 'INV-1']);
  });
});

import type { WorkflowBlock, WorkflowRecordRef, WorkflowStage, WorkflowStageKey } from '@/types/workflow';

/** Records the page could resolve on its own, keyed by the stage they fill. */
export type DerivedRecords = Partial<Record<WorkflowStageKey, WorkflowRecordRef>>;

/** The server's `workflow` block wins for any stage it fills; a stage it leaves
 *  empty (or the whole block, on a backend that does not send it yet) takes the
 *  record the page resolved from its own links (an invoice's source sales order,
 *  a payment's applied invoice). */
export function mergeWorkflow(server: WorkflowBlock | undefined, derived: DerivedRecords): WorkflowBlock {
  const stages = new Map<WorkflowStageKey, WorkflowStage>((server?.stages ?? []).map((s) => [s.key, s]));
  (Object.keys(derived) as WorkflowStageKey[]).forEach((key) => {
    const record = derived[key];
    const existing = stages.get(key);
    if (record && !existing?.records.length) stages.set(key, { ...existing, key, records: [record] });
  });
  return { stages: [...stages.values()] };
}

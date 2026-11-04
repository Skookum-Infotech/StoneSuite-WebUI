import { buildWorkflowStages } from '@/lib/workflowStages';
import type { ProgressModule } from '@/lib/orderProgress';
import type { WorkflowBlock } from '@/types/workflow';
import { RecordProgressCard } from '@/components/tenant/RecordProgressCard';
import { WorkflowStageRow } from '@/components/tenant/WorkflowStageRow';

interface WorkflowCardProps {
  module: ProgressModule;
  recordId: string;
  statusCode: string;
  statusLabel: string;
  /** From the record's detail response. Absent on a backend that does not send
   *  it yet, and the card falls back to this document's own progress list. */
  workflow?: WorkflowBlock;
}

/** Sidebar card above Quick Actions showing the whole flow a record belongs to
 *  (Quote to Payment, or Requisition to Payment), with each stage's linked
 *  record and status. Hovering a stage lists its sub-statuses. */
export function WorkflowCard({ module, recordId, statusCode, statusLabel, workflow }: WorkflowCardProps) {
  const view = workflow ? buildWorkflowStages(module, statusLabel, workflow) : null;
  if (!view) {
    return <RecordProgressCard module={module} recordId={recordId} statusCode={statusCode} statusLabel={statusLabel} />;
  }

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">Workflow</p>
        <span className="text-2xs text-stone-500">Stage {view.hereIndex + 1} of {view.stages.length}</span>
      </div>
      <ol aria-label="Workflow">
        {view.stages.map((stage, idx) => (
          <WorkflowStageRow key={stage.key} stage={stage} isLast={idx === view.stages.length - 1} hereStatusCode={statusCode} />
        ))}
      </ol>
    </div>
  );
}

import { buildWorkflowStages } from '@/lib/workflowStages';
import type { ProgressModule } from '@/lib/orderProgress';
import type { WorkflowBlock } from '@/types/workflow';
import { WorkflowStageRow } from '@/components/tenant/WorkflowStageRow';

interface WorkflowCardProps {
  module: ProgressModule;
  statusCode: string;
  statusLabel: string;
  /** From the record's detail response. Absent on a backend that does not send
   *  it yet; every other stage then reads "Not linked". */
  workflow?: WorkflowBlock;
}

const NO_WORKFLOW: WorkflowBlock = { stages: [] };

/** Sidebar card above Quick Actions showing the whole flow a record belongs to
 *  (Quote to Payment, or Requisition to Payment), with each stage's linked
 *  record and status. Hovering a stage lists its sub-statuses. */
export function WorkflowCard({ module, statusCode, statusLabel, workflow = NO_WORKFLOW }: WorkflowCardProps) {
  const view = buildWorkflowStages(module, statusLabel, workflow);
  if (!view) return null;

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">Progress Bar</p>
        <span className="text-2xs text-stone-500">Stage {view.hereIndex + 1} of {view.stages.length}</span>
      </div>
      <ol aria-label="Progress Bar">
        {view.stages.map((stage, idx) => (
          <WorkflowStageRow key={stage.key} stage={stage} isLast={idx === view.stages.length - 1} hereStatusCode={statusCode} />
        ))}
      </ol>
    </div>
  );
}

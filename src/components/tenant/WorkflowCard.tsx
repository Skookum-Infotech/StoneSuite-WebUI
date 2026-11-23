import { useEffect, useRef, useState } from 'react';
import { buildWorkflowStages } from '@/lib/workflowStages';
import type { ProgressModule } from '@/lib/orderProgress';
import type { WorkflowBlock } from '@/types/workflow';
import { useDerivedWorkflow, type WorkflowLinks } from '@/hooks/useDerivedWorkflow';
import { connectorColor } from '@/components/tenant/workflowStagePalette';
import { WorkflowStageRow } from '@/components/tenant/WorkflowStageRow';

interface WorkflowCardProps {
  module: ProgressModule;
  statusCode: string;
  statusLabel: string;
  /** From the record's detail response. Absent on a backend that does not send
   *  it yet; every other stage then reads "Not linked". */
  workflow?: WorkflowBlock;
  /** Ids of the records this one came from (its source sales order, applied
   *  invoice, payment); resolved client-side to fill stages the server left empty. */
  links?: WorkflowLinks;
}

const NO_LINKS: WorkflowLinks = {};

const NO_WORKFLOW: WorkflowBlock = { stages: [] };

/** Sidebar card above Quick Actions showing the whole flow a record belongs to
 *  (Quote to Payment, or Requisition to Payment), with each stage's linked
 *  record and status. Clicking a stage pins its sub-status panel open; only one is open at a time. */
export function WorkflowCard({ module, statusCode, statusLabel, workflow = NO_WORKFLOW, links = NO_LINKS }: WorkflowCardProps) {
  const merged = useDerivedWorkflow(links, workflow);
  const view = buildWorkflowStages(module, statusLabel, merged, statusCode);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // A pinned panel closes on Esc or a click outside the card, nothing else.
  useEffect(() => {
    if (!openKey) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenKey(null); };
    const onDown = (e: MouseEvent) => { if (!cardRef.current?.contains(e.target as Node)) setOpenKey(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [openKey]);

  if (!view) return null;

  return (
    <div ref={cardRef} className="mb-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">Progress Bar</p>
        <span className="text-2xs text-stone-500">Stage {view.hereIndex + 1} of {view.stages.length}</span>
      </div>
      <ol aria-label="Progress Bar">
        {view.stages.map((stage, idx) => (
          <WorkflowStageRow
            key={stage.key}
            stage={stage}
            isLast={idx === view.stages.length - 1}
            hereStatusCode={statusCode}
            lineColor={connectorColor(view.stages, idx)}
            open={openKey === stage.key}
            locked={openKey !== null && openKey !== stage.key}
            onToggle={() => setOpenKey((cur) => (cur === null ? stage.key : cur === stage.key ? null : cur))}
          />
        ))}
      </ol>
    </div>
  );
}

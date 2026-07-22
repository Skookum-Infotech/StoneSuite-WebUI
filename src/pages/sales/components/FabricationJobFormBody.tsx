import type { Ref, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import { readonlyCls } from '@/components/crm/formUtils';
import { FJSectionGrid } from './FabricationJobFormFields';
import { FabricationSourceOrderPicker, type FabricationSourceOrder } from './FabricationSourceOrderPicker';
import { FabricationPiecesEditor } from './FabricationPiecesEditor';
import { FabricationPiecesEditableTab } from './FabricationPiecesEditableTab';
import { FabricationPiecesTable } from './FabricationPiecesTable';
import { FabricationSlabsTab } from './FabricationSlabsTab';
import { FabricationStepsTab } from './FabricationStepsTab';
import type { CrmLookups } from '@/services/lookupService';
import type { FabricationJob } from '@/types/fabrication';
import {
  SITE_FIELDS, SCHEDULE_FIELDS, CREW_FIELDS, NOTES_FIELDS,
  PAGE_TABS, type PageTab, type FJPieceRow,
} from '@/lib/fabricationForm';

// Shared tab bar + tab content for the Add and Edit Fabrication Job pages —
// mirrors SalesOrderFormBody's Add/Edit split, extended with
// fabrication-specific tabs (Slabs/Checklist) that only have live data once a
// job exists (jobId set) — same "available after saving" pattern
// SalesOrderFormBody uses for Inventory/Audit.
export function FabricationJobFormBody({
  activeTab, setActiveTab, jobId, job,
  data, set,
  sourceOrder, setSourceOrder,
  pieces, setPieces, sourceOrderItems = [],
  lookups, statusControl, holdResumeControl, approvalControl,
  canAllocateSlabs = false, canEditSteps = false, piecesEditableNow = false,
  filesPanelRef,
}: {
  activeTab: PageTab;
  setActiveTab: (t: PageTab) => void;
  /** Present only once the job is persisted (edit mode) — gates the
   *  Slabs/Checklist tabs and switches Files to immediate-upload mode. */
  jobId?: string;
  /** Full loaded job (edit mode only) — supplies pieces/steps for their tabs. */
  job?: FabricationJob;
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  /** The originating sales order — pickable in create mode, read-only (a
   *  link) in edit mode since a job's sales order is fixed after creation. */
  sourceOrder: FabricationSourceOrder | null;
  setSourceOrder?: (o: FabricationSourceOrder | null) => void;
  /** Editable piece rows — create mode's local, unsaved draft list (edit mode
   *  ignores this; it edits job.pieces directly via the pieces API instead,
   *  gated by piecesEditableNow). */
  pieces: FJPieceRow[];
  setPieces?: (v: FJPieceRow[]) => void;
  sourceOrderItems?: { id: string; label: string }[];
  lookups?: CrmLookups;
  /** Interactive status control (edit mode only) — a new job always starts
   *  at Order Received once created, so create mode omits this. */
  statusControl?: ReactNode;
  holdResumeControl?: ReactNode;
  approvalControl?: ReactNode;
  canAllocateSlabs?: boolean;
  canEditSteps?: boolean;
  /** Edit mode only — true when both canEditPieces(job.statusCode) and
   *  installation:update hold, so the Pieces tab renders the server-backed
   *  editor instead of the read-only table. */
  piecesEditableNow?: boolean;
  filesPanelRef?: Ref<EditableFilesPanelHandle>;
}) {
  const isEdit = Boolean(jobId && job);

  return (
    <>
      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-stone-800 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto modal-scrollbar">
        <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

          {activeTab === 'details' && (
            <>
              <ModernSection title="Job Status" index={0}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ModernFieldShell label="Fabrication Status">
                    {statusControl ?? (
                      <div className={cn(readonlyCls, 'cursor-not-allowed select-none')}>Order Received</div>
                    )}
                  </ModernFieldShell>
                  {holdResumeControl && (
                    <ModernFieldShell label="Hold / Resume">{holdResumeControl}</ModernFieldShell>
                  )}
                  {approvalControl && (
                    <ModernFieldShell label="Approval">{approvalControl}</ModernFieldShell>
                  )}
                </div>
              </ModernSection>

              <ModernSection title="Sales Order" index={1}>
                <ModernFieldShell label="Originating Sales Order" required={!isEdit}>
                  {isEdit && job ? (
                    <Link
                      to={`/sales/sales_order/${job.salesOrderId}`}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-xs font-semibold text-accent-foreground hover:bg-stone-100 transition-colors"
                    >
                      <ShoppingCart className="size-3.5" />
                      View Sales Order
                    </Link>
                  ) : (
                    <FabricationSourceOrderPicker value={sourceOrder} onChange={(o) => setSourceOrder?.(o)} />
                  )}
                </ModernFieldShell>
              </ModernSection>

              <ModernSection title="Job Site" index={2}>
                <FJSectionGrid fields={SITE_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
              <ModernSection title="Schedule" index={3}>
                <FJSectionGrid fields={SCHEDULE_FIELDS} data={data} set={set} lookups={lookups} maxCols={2} />
              </ModernSection>
              <ModernSection title="Crew Assignment" index={4}>
                <FJSectionGrid fields={CREW_FIELDS} data={data} set={set} lookups={lookups} maxCols={2} />
              </ModernSection>
              <ModernSection title="Notes" index={5}>
                <FJSectionGrid fields={NOTES_FIELDS} data={data} set={set} lookups={lookups} />
              </ModernSection>
            </>
          )}

          {activeTab === 'pieces' && (
            isEdit && job
              ? piecesEditableNow
                ? <FabricationPiecesEditableTab jobId={jobId!} pieces={job.pieces ?? []} sourceOrderItems={sourceOrderItems} />
                : <FabricationPiecesTable pieces={job.pieces ?? []} />
              : <FabricationPiecesEditor pieces={pieces} onUpdate={(v) => setPieces?.(v)} sourceOrderItems={sourceOrderItems} />
          )}

          {activeTab === 'slabs' && (
            isEdit && job
              ? <FabricationSlabsTab jobId={jobId!} pieces={job.pieces ?? []} canAllocate={canAllocateSlabs} />
              : <p className="py-8 text-center text-xs text-stone-400">Slab allocation will be available after saving the job.</p>
          )}

          {activeTab === 'checklist' && (
            isEdit && job
              ? <FabricationStepsTab jobId={jobId!} steps={job.steps ?? []} canEdit={canEditSteps} />
              : <p className="py-8 text-center text-xs text-stone-400">The checklist is seeded once the job is saved.</p>
          )}

          <div className={activeTab === 'files' ? '' : 'hidden'}>
            <EditableFilesPanel ref={filesPanelRef} recordId={jobId} />
          </div>
        </div>
      </div>
    </>
  );
}

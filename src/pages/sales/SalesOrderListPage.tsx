import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAIStatus } from '@/hooks/useAIStatus';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { UploadDocumentButton } from '@/components/tenant/UploadDocumentButton';
import { CreateFromDocumentDialog } from '@/components/tenant/documentExtraction/CreateFromDocumentDialog';
import { DropOverlay } from '@/components/tenant/documentExtraction/DropOverlay';
import { PendingDocumentsChip } from '@/components/tenant/documentExtraction/PendingDocumentsChip';
import { uploadDisabledReason } from '@/lib/documentUploadAvailability';
import { SalesOrderTable } from './components/SalesOrderTable';

export default function SalesOrderListPage() {
  const navigate = useNavigate();
  // A customer-portal session reads this same page (see CLAUDE.md's
  // merged-login design) but never creates a sales order — the backend has
  // no such endpoint under /api/portal/*, so the button would always 404.
  const isCustomer = useAuthStore((s) => s.kind === 'portal');
  const { hasPermission } = useUserPermissions();
  const { data: aiStatus, isLoading: aiLoading, isError: aiFailed } = useAIStatus();

  const canCreate = !isCustomer && hasPermission('sales_order', 'create');
  const extractionOn = aiStatus?.documentExtraction === true;
  // The flow needs the AI feature on; until the status loads the button stays
  // disabled without a reason rather than flashing "turned off". The reason
  // names the switch that is actually off (platform vs workspace vs flag).
  const uploadDisabled = !extractionOn;
  const uploadReason = uploadDisabledReason(aiStatus, aiLoading, aiFailed) || undefined;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const closeDialog = useCallback(() => setPendingFile(null), []);
  // A drop is always swallowed on this page (the browser would otherwise open
  // the file and lose the list); this is what the user is told when it can't
  // start the flow. '' = swallow silently (portal, or AI status still loading).
  const dropBlockedReason = isCustomer ? ''
    : !canCreate ? "You don't have permission to create sales orders."
    : !extractionOn ? uploadReason ?? ''
    : pendingFile !== null ? 'Finish or close the current document first.'
    : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <ShoppingCart className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Sales Orders</h1>
              <p className="text-sm text-stone-500">Confirmed customer orders ready for fulfillment.</p>
            </div>
          </div>
          {!isCustomer && (
            <button
              onClick={() => navigate('/sales/sales_order/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Sales Order
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <SalesOrderTable
            toolbarActions={
              canCreate && (
                <>
                  <PendingDocumentsChip docType="sales_order" enabled={extractionOn} />
                  <UploadDocumentButton
                    documentLabel="Sales Order"
                    onFileSelected={setPendingFile}
                    disabled={uploadDisabled}
                    disabledReason={uploadReason}
                  />
                </>
              )
            }
          />
        </div>
      </div>

      <DropOverlay
        blockedReason={dropBlockedReason}
        documentLabel="Sales Order"
        onFileDropped={setPendingFile}
      />
      {pendingFile && <CreateFromDocumentDialog file={pendingFile} onClose={closeDialog} />}
    </div>
  );
}

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAIStatus } from '@/hooks/useAIStatus';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { UploadDocumentButton } from '@/components/tenant/UploadDocumentButton';
import { CreateFromDocumentDialog } from '@/components/tenant/documentExtraction/CreateFromDocumentDialog';
import { DropOverlay } from '@/components/tenant/documentExtraction/DropOverlay';
import { PendingDocumentsChip } from '@/components/tenant/documentExtraction/PendingDocumentsChip';
import { uploadDisabledReason } from '@/lib/documentUploadAvailability';
import { VendorBillTable } from './components/VendorBillTable';

export default function VendorBillListPage() {
  const navigate = useNavigate();
  // A customer-portal session never creates vendor bills; hide the whole flow.
  const isCustomer = useAuthStore((s) => s.kind === 'portal');
  const { hasPermission, isLoading } = useUserPermissions();
  const { data: aiStatus, isLoading: aiLoading, isError: aiFailed } = useAIStatus();

  const canCreate = !isCustomer && (isLoading || hasPermission('vendor_bill', 'create'));
  const extractionOn = aiStatus?.documentExtraction === true;
  // The flow needs the AI feature on; until the status loads the button stays
  // disabled without a reason rather than flashing "turned off".
  const uploadReason = uploadDisabledReason(aiStatus, aiLoading, aiFailed) || undefined;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const closeDialog = useCallback(() => setPendingFile(null), []);
  // A drop is always swallowed on this page (the browser would otherwise open
  // the file and lose the list); '' = swallow silently.
  const dropBlockedReason = isCustomer ? ''
    : !canCreate ? "You don't have permission to create vendor bills."
    : !extractionOn ? uploadReason ?? ''
    : pendingFile !== null ? 'Finish or close the current document first.'
    : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <FileCheck className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Vendor Bills</h1>
              <p className="text-sm text-stone-500">Record and approve bills received from vendors.</p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/purchases/vendor_bill/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Vendor Bill
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <VendorBillTable
            toolbarActions={
              canCreate && (
                <>
                  <PendingDocumentsChip docType="vendor_bill" enabled={extractionOn} />
                  <UploadDocumentButton
                    documentLabel="Vendor Bill"
                    onFileSelected={setPendingFile}
                    disabled={!extractionOn}
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
        documentLabel="Vendor Bill"
        onFileDropped={setPendingFile}
      />
      {pendingFile && <CreateFromDocumentDialog file={pendingFile} docType="vendor_bill" onClose={closeDialog} />}
    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { binTransferService } from '@/services/binTransferService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { btIsEditable } from '@/lib/binTransferStatus';
import type { BinTransferInput } from '@/types/binTransfer';
import { BinTransferEditor } from './components/BinTransferEditor';

const LIST_PATH = '/inventory/bin_transfer';

// Only a draft can be edited: approval freezes the document so the moves that
// were signed off are the ones applied. A transfer past Draft is bounced to its
// page, which says what to do instead (Revise).
export default function EditBinTransferPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: bt, isLoading, error } = useQuery({
    queryKey: ['bin-transfer', id],
    queryFn: () => binTransferService.get(id),
    enabled: Boolean(id),
  });

  const update = useMutation({
    mutationFn: (input: BinTransferInput) => binTransferService.update(id, input),
    onSuccess: () => {
      toast.success('Bin transfer saved.');
      queryClient.invalidateQueries({ queryKey: ['bin-transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['bin-transfers'] });
    },
  });

  // Navigating is done here, not in the mutation's onSuccess, so the editor's
  // unsaved-changes guard can be cleared first. A failure needs no handling:
  // it is shown through `update.error` and the guard stays armed.
  async function handleSubmit(input: BinTransferInput, markClean: () => void): Promise<void> {
    const saved = await update.mutateAsync(input).then(() => true, () => false);
    if (!saved) return;
    markClean();
    navigate(`${LIST_PATH}/${id}`);
  }

  if (isLoading) return <div className="p-6"><Spinner label="Loading bin transfer…" /></div>;
  if (!bt) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load the bin transfer.')}</ErrorNote></div>;

  if (!btIsEditable(bt.statusCode)) {
    return (
      <div className="p-6 space-y-3">
        <ErrorNote>
          {bt.number} is {bt.statusName.toLowerCase()} and can no longer be edited. Use Revise on its page to reopen it.
        </ErrorNote>
        <button
          type="button"
          onClick={() => navigate(`${LIST_PATH}/${id}`)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Back to {bt.number}
        </button>
      </div>
    );
  }

  return (
    <BinTransferEditor
      initial={bt}
      copy={{
        title: `Edit ${bt.number}`,
        subtitle: 'Only a draft can be edited. Saving keeps it a draft.',
        backLabel: bt.number,
        submitLabel: 'Save Changes',
      }}
      onSubmit={(input, markClean) => { void handleSubmit(input, markClean); }}
      status={{ isPending: update.isPending, error: update.error }}
      onCancel={() => navigate(`${LIST_PATH}/${id}`)}
    />
  );
}

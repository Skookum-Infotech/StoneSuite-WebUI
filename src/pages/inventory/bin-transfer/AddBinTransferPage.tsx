import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { binTransferService } from '@/services/binTransferService';
import { BinTransferEditor } from './components/BinTransferEditor';

const LIST_PATH = '/inventory/bin_transfer';

// Saving writes a draft only — nothing moves. It lands on the transfer's own
// page, where Submit for Approval (or Complete, when nobody is configured to
// approve) is the obvious next step.
export default function AddBinTransferPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: binTransferService.create,
    onSuccess: (bt) => {
      toast.success(`${bt.number} saved as a draft.`);
      queryClient.invalidateQueries({ queryKey: ['bin-transfers'] });
      navigate(`${LIST_PATH}/${bt.id}`);
    },
  });

  return (
    <BinTransferEditor
      copy={{
        title: 'New Bin Transfer',
        subtitle: 'Choose a location, add the slabs, and pick the bin each one is going to.',
        backLabel: 'Bin Transfers',
        submitLabel: 'Save Draft',
      }}
      onSubmit={(input) => create.mutate(input)}
      status={{ isPending: create.isPending, error: create.error }}
      onCancel={() => navigate(LIST_PATH)}
    />
  );
}

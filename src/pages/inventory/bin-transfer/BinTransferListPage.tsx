import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { BinTransferTable } from './components/BinTransferTable';

export default function BinTransferListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('bin_transfer', 'create');
  const startNew = () => navigate('/inventory/bin_transfer/new');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
              <ArrowLeftRight className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Bin Transfers</h1>
              <p className="text-sm text-stone-500">Move slabs between bins, with approval and a full trail of who moved what.</p>
            </div>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Bin Transfer
            </button>
          )}
        </div>

        <div className="mt-5 flex-1 min-h-0 overflow-y-auto border-t border-stone-100 pt-4 modal-scrollbar">
          <BinTransferTable emptyAction={canCreate ? startNew : undefined} />
        </div>
      </div>
    </div>
  );
}

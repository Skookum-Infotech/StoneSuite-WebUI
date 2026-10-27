import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryBinService } from '@/services/inventoryBinService';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { cn } from '@/lib/utils';
import { BinContentsTab } from './components/BinContentsTab';
import { BinHistoryTab } from './components/BinHistoryTab';

const TABS = [
  { key: 'contents', label: 'Contents' },
  { key: 'history', label: 'Movement history' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', tone === 'warn' ? 'text-amber-700' : 'text-stone-900')}>{value}</p>
      {hint && <p className="text-2xs text-stone-500">{hint}</p>}
    </div>
  );
}

// One bin: what is in it now, and everything that has moved in or out of it.
// Opened from a bin's name in Bin Management.
export default function BinDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('contents');

  const { data: bin, isLoading, error } = useQuery({
    queryKey: ['inventory-bin', id],
    queryFn: () => inventoryBinService.getBin(id),
    enabled: Boolean(id),
  });

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    if (bin?.name || bin?.code) {
      setLabel(id, bin.name || bin.code);
      return () => clearLabel(id);
    }
  }, [id, bin?.name, bin?.code, setLabel, clearLabel]);

  if (isLoading) return <div className="p-6"><Spinner label="Loading bin…" /></div>;
  if (!bin) return <div className="p-6"><ErrorNote>{apiErrorMessage(error, 'Failed to load the bin.')}</ErrorNote></div>;

  const capacity = bin.capacityUnits > 0 ? `${bin.unitCount} / ${bin.capacityUnits}` : 'No limit';

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <CrmPageHeader
        backLabel="Bin Management"
        onBack={() => navigate('/inventory/bin')}
        icon={MapPin}
        title={bin.name || bin.code}
        subtitle={`${bin.path} · ${bin.warehouseName ?? ''}`.replace(/ · $/, '')}
        statusBadge={(
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-2xs font-semibold capitalize text-stone-600">{bin.type}</span>
            {bin.isWip && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-2xs font-semibold text-violet-700">WIP</span>}
            {!bin.isActive && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-2xs font-semibold text-stone-500">Inactive</span>}
          </span>
        )}
      />

      <div className="grid grid-cols-2 gap-3 border-b border-stone-200 bg-white px-5 py-3 sm:grid-cols-3 3xl:px-12 4xl:px-16">
        <Stat label="Slabs in bin" value={String(bin.unitCount)} />
        <Stat label="Capacity" value={capacity} hint={bin.overCapacity ? 'Over capacity — advisory only' : undefined} tone={bin.overCapacity ? 'warn' : undefined} />
        <Stat label="Location" value={bin.warehouseName || '—'} />
      </div>

      <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-12 4xl:px-16 modal-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 -mb-px px-4 py-3 text-sm font-semibold transition-colors',
              activeTab === tab.key
                ? 'border-brand text-stone-950'
                : 'border-transparent text-stone-500 hover:border-stone-200 hover:text-stone-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 sm:px-5 sm:py-5 3xl:px-12 3xl:py-8 4xl:px-16 4xl:py-10">
        {activeTab === 'contents' && <BinContentsTab binId={id} />}
        {activeTab === 'history' && <BinHistoryTab binId={id} />}
      </div>
    </div>
  );
}

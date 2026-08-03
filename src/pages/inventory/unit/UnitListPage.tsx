import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { UnitTable } from './components/UnitTable';
import { RemnantsFinder } from './components/RemnantsFinder';

const TABS = [
  { key: 'all', label: 'All Units' },
  { key: 'remnants', label: 'Find Remnants' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default function UnitListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('inventory_unit', 'create');
  const [tab, setTab] = useState<Tab>('all');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Layers className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Units &amp; Slabs</h1>
              <p className="text-sm text-stone-500">Track physical slabs and remnants — move, cut and scrap.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/inventory/unit/new')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95">
              <Plus className="size-3.5" /> Receive Slab
            </button>
          )}
        </div>

        <div className="mt-5 flex gap-1 border-b border-stone-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.key ? 'border-brand text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex-1 flex flex-col min-h-0">
          {tab === 'all' ? <UnitTable /> : <RemnantsFinder />}
        </div>
      </div>
    </div>
  );
}

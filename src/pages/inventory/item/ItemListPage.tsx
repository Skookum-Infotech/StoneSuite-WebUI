import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boxes, Package, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ItemTable } from './components/ItemTable';
import { KitTable } from './components/KitTable';

const TAB_PARAM = 'tab';
const TABS = [
  { key: 'items', label: 'Items' },
  { key: 'kits', label: 'Kits' },
] as const;
type ListTab = (typeof TABS)[number]['key'];

export default function ItemListPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { hasPermission, isLoading } = useUserPermissions();
  const canCreate = isLoading || hasPermission('inventory_item', 'create');

  // The tab is in the address so "back" from a kit lands on the Kits tab.
  const tab: ListTab = params.get(TAB_PARAM) === 'kits' ? 'kits' : 'items';

  function selectTab(next: ListTab) {
    const nextParams = new URLSearchParams(params);
    if (next === 'items') nextParams.delete(TAB_PARAM);
    else nextParams.set(TAB_PARAM, next);
    setParams(nextParams, { replace: true });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Package className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Inventory Items</h1>
              <p className="text-sm text-stone-500">Manage the stone catalogue tenants sell from.</p>
            </div>
          </div>
          {canCreate && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate('/inventory/kit/new')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-800 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-violet-100 active:scale-95"
              >
                <Boxes className="size-3.5" />
                New Kit
              </button>
              <button
                onClick={() => navigate('/inventory/item/new')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
              >
                <Plus className="size-3.5" />
                New Item
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0 gap-3">
          <div role="tablist" aria-label="Inventory catalogue" className="flex gap-1 border-b border-stone-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`item-list-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls="item-list-panel"
                onClick={() => selectTab(t.key)}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  tab === t.key
                    ? 'border-brand text-stone-950'
                    : 'border-transparent text-stone-500 hover:border-stone-200 hover:text-stone-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id="item-list-panel" role="tabpanel" aria-labelledby={`item-list-tab-${tab}`} className="flex-1 flex flex-col min-h-0">
            {tab === 'kits' ? <KitTable /> : <ItemTable />}
          </div>
        </div>
      </div>
    </div>
  );
}

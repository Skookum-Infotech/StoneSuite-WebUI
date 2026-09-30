import { useState } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnitTable } from './components/UnitTable';
import { RemnantsFinder } from './components/RemnantsFinder';

const TABS = [
  { key: 'all', label: 'All Units' },
  { key: 'remnants', label: 'Find Remnants' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// The live stock list. Slabs are not added here: a slab enters inventory only
// when an item receipt against a purchase order is posted, so there is
// deliberately no "new" button on this page.
export default function UnitListPage() {
  const [tab, setTab] = useState<Tab>('all');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
            <Layers className="size-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Inventory</h1>
            <p className="text-sm text-stone-500">
              Every slab and remnant on hand — move, cut and scrap. Slabs are added by receiving a purchase order.
            </p>
          </div>
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

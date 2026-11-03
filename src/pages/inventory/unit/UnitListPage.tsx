import { useState } from 'react';
import { Layers } from 'lucide-react';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { UnitTable } from './components/UnitTable';
import { RemnantsFinder } from './components/RemnantsFinder';
import { StockOnHandTable } from './components/StockOnHandTable';

const TABS = [
  { key: 'all', label: 'All Units' },
  { key: 'stock', label: 'Stock on Hand' },
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
              Every slab and remnant on hand — move, cut and scrap — and the stock of everything else you count. Slabs are added by receiving a purchase order.
            </p>
          </div>
        </div>

        <div className="mt-5 flex border-b border-stone-200 py-2.5">
          <div role="tablist" className={TAB_LIST_CLASS}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={tabClass(tab === t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex-1 flex flex-col min-h-0">
          {tab === 'all' && <UnitTable />}
          {tab === 'stock' && <StockOnHandTable />}
          {tab === 'remnants' && <RemnantsFinder />}
        </div>
      </div>
    </div>
  );
}

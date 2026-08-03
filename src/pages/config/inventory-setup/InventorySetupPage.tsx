import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LookupKind } from '@/types/inventory';
import { LookupVocabularyTable } from './components/LookupVocabularyTable';

const TABS: { key: LookupKind; label: string }[] = [
  { key: 'materials', label: 'Materials' },
  { key: 'colors', label: 'Colors' },
  { key: 'finishes', label: 'Finishes' },
  { key: 'reasons', label: 'Reasons' },
  { key: 'units', label: 'Units' },
  { key: 'tax-rates', label: 'Tax Rates' },
];

// Configure > Inventory Setup — vocabulary admin for the inventory module.
// colors ships empty by design server-side; this is where a tenant fills it
// in (spec §1). units and tax-rates are read-only server-side.
export default function InventorySetupPage() {
  const [tab, setTab] = useState<LookupKind>('materials');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
            <Settings2 className="size-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">Inventory Setup</h1>
            <p className="text-sm text-stone-500">Manage the vocabularies inventory forms draw from.</p>
          </div>
        </div>

        <div className="mt-5 flex gap-1 border-b border-stone-200 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                tab === t.key ? 'border-brand text-stone-950' : 'border-transparent text-stone-500 hover:text-stone-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto modal-scrollbar">
          <LookupVocabularyTable kind={tab} label={TABS.find((t) => t.key === tab)!.label} />
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ListTree, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountTreeView } from './components/AccountTreeView';
import { AccountTableView } from './components/AccountTableView';

type ViewMode = 'tree' | 'table';

// Two view modes backed by the same service: the grouped tree (the stated
// requirement, rendered exactly as /accounts/tree returns it) and a flat
// filterable table for power users, via /accounts/search.
export default function ChartOfAccountsPage() {
  const [view, setView] = useState<ViewMode>('tree');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <ListTree className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Chart of Accounts</h1>
              <p className="text-sm text-stone-500">The tenant&apos;s fixed category tree and postable accounts.</p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setView('tree')}
              aria-pressed={view === 'tree'}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
                view === 'tree' ? 'bg-accent text-accent-foreground' : 'text-stone-500 hover:bg-stone-50',
              )}
            >
              <ListTree className="size-3.5" />
              Tree
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
                view === 'table' ? 'bg-accent text-accent-foreground' : 'text-stone-500 hover:bg-stone-50',
              )}
            >
              <Table2 className="size-3.5" />
              Table
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0 overflow-y-auto modal-scrollbar">
          {view === 'tree' ? <AccountTreeView /> : <AccountTableView />}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, Plus, X } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Switch } from '@/components/ui/switch';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import type { Account } from '@/types/chartOfAccounts';
import { AccountTreeRow } from './AccountTreeRow';
import { BulkActionBar } from './BulkActionBar';
import { AccountFormDrawer, type AccountParentRef } from './AccountFormDrawer';

const SEARCH_RESULT_LIMIT = 100;

type DrawerState =
  | { mode: 'create' }
  | { mode: 'create-child'; parent: AccountParentRef }
  | { mode: 'edit'; account: Account }
  | null;

function toParentRef(a: Account): AccountParentRef {
  return {
    id: a.id, code: a.code, name: a.name,
    subCategoryId: a.subCategoryId, subCategoryCode: a.subCategoryCode, subCategoryName: a.subCategoryName,
  };
}

// The primary Chart of Accounts screen: the grouped report exactly as
// /accounts/tree returns it (BS/PNL -> category -> sub-category -> account ->
// children) — the frontend renders, it does not group. Typing a search term
// switches to a flat filtered list via /accounts/search instead of trying to
// reconstruct a partial tree from a subset of matches.
export function AccountTreeView() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('chart_of_account', 'update');
  const canCreate = permissionsLoading || hasPermission('chart_of_account', 'create');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const {
    data: sections = [], isLoading: treeLoading, isError: treeIsError, error: treeError,
  } = useQuery({
    queryKey: ['coa-tree', includeInactive, includeHidden],
    queryFn: () => chartOfAccountsService.getTree({ includeInactive, includeHidden }),
    enabled: !debounced,
  });

  const {
    data: searchPage, isLoading: searchLoading, isError: searchIsError, error: searchError,
  } = useQuery({
    queryKey: ['coa-tree-search', debounced, includeInactive, includeHidden],
    queryFn: () => chartOfAccountsService.searchAccounts(
      { search: debounced, sort: [{ field: 'code', dir: 'asc' }], limit: SEARCH_RESULT_LIMIT },
      { active: includeInactive ? undefined : true, visible: includeHidden ? undefined : true },
    ),
    enabled: Boolean(debounced),
  });

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const openEdit = (account: Account) => setDrawer({ mode: 'edit', account });
  const openAddSubAccount = (account: Account) => setDrawer({ mode: 'create-child', parent: toParentRef(account) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search code or name…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-8 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
            aria-label="Search accounts by code or name"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} aria-label="Include inactive accounts" />
          Include inactive
        </label>
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <Switch checked={includeHidden} onCheckedChange={setIncludeHidden} aria-label="Include hidden accounts" />
          Include hidden
        </label>

        {canCreate && (
          <button
            type="button"
            onClick={() => setDrawer({ mode: 'create' })}
            className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-1.5 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
          >
            <Plus className="size-3.5" />
            New Account
          </button>
        )}
      </div>

      <BulkActionBar selectedIds={[...selectedIds]} onClear={() => setSelectedIds(new Set())} />

      {debounced ? (
        searchLoading ? (
          <Spinner label="Searching…" />
        ) : searchIsError ? (
          <ErrorNote>{apiErrorMessage(searchError, 'Failed to search accounts.')}</ErrorNote>
        ) : (searchPage?.records.length ?? 0) === 0 ? (
          <EmptyState>No accounts match &ldquo;{debounced}&rdquo;.</EmptyState>
        ) : (
          <div className="divide-y divide-stone-50 rounded-xl border border-stone-200 bg-white px-2 py-2 shadow-sm">
            {searchPage?.records.map((a) => (
              <AccountTreeRow
                key={a.id}
                account={{ ...a, children: [] }}
                depth={a.depth}
                canUpdate={canUpdate}
                canCreate={canCreate}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onEdit={openEdit}
                onAddSubAccount={openAddSubAccount}
              />
            ))}
            {searchPage?.hasMore && (
              <p className="px-2 py-2 text-2xs text-stone-400">
                Showing the first {SEARCH_RESULT_LIMIT} matches. Refine your search or use the table view for full pagination.
              </p>
            )}
          </div>
        )
      ) : treeLoading ? (
        <Spinner label="Loading chart of accounts…" />
      ) : treeIsError ? (
        <ErrorNote>{apiErrorMessage(treeError, 'Failed to load the chart of accounts.')}</ErrorNote>
      ) : sections.length === 0 ? (
        <EmptyState>No accounts to show with the current filters.</EmptyState>
      ) : (
        sections.map((section) => {
          const secKey = `sec-${section.bsPnl}`;
          const secCollapsed = collapsed.has(secKey);
          return (
            <div key={section.bsPnl} className="rounded-xl border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleCollapse(secKey)}
                aria-expanded={!secCollapsed}
                className="flex w-full items-center justify-between px-4 py-3 border-b border-stone-100"
              >
                <span className="text-sm font-bold text-stone-900">{section.label}</span>
                <ChevronDown className={cn('size-4 text-stone-400 transition-transform', secCollapsed && '-rotate-90')} />
              </button>

              {!secCollapsed && (
                <div className="px-2 py-2">
                  {section.categories.map((cat) => {
                    const catKey = `cat-${cat.id}-${section.bsPnl}`;
                    const catCollapsed = collapsed.has(catKey);
                    return (
                      <div key={catKey} className="py-1">
                        <button
                          type="button"
                          onClick={() => toggleCollapse(catKey)}
                          aria-expanded={!catCollapsed}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-stone-50"
                        >
                          <ChevronDown className={cn('size-3.5 text-stone-400 transition-transform', catCollapsed && '-rotate-90')} />
                          <span className="text-xs font-semibold text-stone-700">{cat.code} · {cat.name}</span>
                        </button>

                        {!catCollapsed && (
                          <div className="ml-4 space-y-1">
                            {cat.subCategories.map((sub) => {
                              const subKey = `sub-${sub.id}-${section.bsPnl}`;
                              const subCollapsed = collapsed.has(subKey);
                              return (
                                <div key={subKey}>
                                  <button
                                    type="button"
                                    onClick={() => toggleCollapse(subKey)}
                                    aria-expanded={!subCollapsed}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-stone-50"
                                  >
                                    <ChevronDown className={cn('size-3 text-stone-300 transition-transform', subCollapsed && '-rotate-90')} />
                                    <span className="text-2xs font-semibold uppercase tracking-wide text-stone-400">
                                      {sub.code} — {sub.name}
                                    </span>
                                  </button>

                                  {!subCollapsed && (
                                    sub.accounts.length === 0 ? (
                                      <p className="pl-8 py-1 text-2xs italic text-stone-300">No accounts yet.</p>
                                    ) : (
                                      <div>
                                        {sub.accounts.map((acct) => (
                                          <AccountTreeRow
                                            key={acct.id}
                                            account={acct}
                                            canUpdate={canUpdate}
                                            canCreate={canCreate}
                                            selectedIds={selectedIds}
                                            onToggleSelect={toggleSelect}
                                            onEdit={openEdit}
                                            onAddSubAccount={openAddSubAccount}
                                          />
                                        ))}
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {drawer?.mode === 'create' && (
        <AccountFormDrawer onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} />
      )}
      {drawer?.mode === 'create-child' && (
        <AccountFormDrawer onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} parent={drawer.parent} />
      )}
      {drawer?.mode === 'edit' && (
        <AccountFormDrawer onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} account={drawer.account} />
      )}
    </div>
  );
}

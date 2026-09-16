import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight, ChevronDown, ChevronsDown, ChevronsUp, FolderPlus, Plus, X } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useHighlightOnCreate } from '@/hooks/useHighlightOnCreate';
import { Switch } from '@/components/ui/switch';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { placementLabel, placementOf, type Placement } from '@/lib/coaPlacement';
import { accountRowDomId, HighlightedAccountContext } from '@/lib/coaAccountHighlight';
import type { Account, TreeSection } from '@/types/chartOfAccounts';
import { AccountTreeRow, type TreeRowActions, type TreeRowPerms } from './AccountTreeRow';
import { BulkActionBar } from './BulkActionBar';
import { AccountFormDrawer, type AccountParentRef } from './AccountFormDrawer';
import { TaxonomyFormDialog, type TaxonomyIntent } from './TaxonomyFormDialog';
import { TaxonomyGroupHeader, type TaxonomyGroup } from './TaxonomyGroupHeader';

const SEARCH_RESULT_LIMIT = 100;

type DrawerState =
  // initialPlacement is set when opened from a category/sub-category's own
  // inline "+" — the click already said where the account goes, so the
  // picker opens pre-selected instead of forcing the user to choose again.
  | { mode: 'create'; initialPlacement?: Placement; initialPlacementLabel?: string }
  | { mode: 'create-child'; parent: AccountParentRef }
  | { mode: 'edit'; account: Account }
  | null;

function toParentRef(a: Account): AccountParentRef {
  return {
    id: a.id,
    code: a.code,
    name: a.name,
    placement: placementOf(a),
    placementLabel: placementLabel(a),
  };
}

// The collapse keys standing between a freshly created account and actually
// being visible — its section, its category, and (unless it was placed
// directly on the category) its sub-category. Built from the account itself
// rather than looked up in `sections`, so it's available the instant create
// succeeds, before the invalidated query has refetched.
function ancestorKeysFor(account: Account): string[] {
  const keys = [`sec-${account.bsPnl}`, `cat-${account.categoryId}-${account.bsPnl}`];
  if (account.subCategoryId) keys.push(`sub-${account.subCategoryId}-${account.bsPnl}`);
  return keys;
}

// Every section/category/sub-category group key — the full expand/collapse
// surface, used by "Collapse All" (mirrors accountingPeriodTree's allGroupKeys).
function allGroupKeys(sections: TreeSection[]): string[] {
  const keys: string[] = [];
  for (const section of sections) {
    keys.push(`sec-${section.bsPnl}`);
    for (const cat of section.categories) {
      keys.push(`cat-${cat.id}-${section.bsPnl}`);
      for (const sub of cat.subCategories) {
        keys.push(`sub-${sub.id}-${section.bsPnl}`);
      }
    }
  }
  return keys;
}

// The primary Chart of Accounts screen: the grouped report exactly as
// /accounts/tree returns it (BS/PNL -> category -> direct accounts ->
// sub-category -> account -> children) — the frontend renders, it does not
// group. Typing a search term switches to a flat filtered list via
// /accounts/search instead of trying to reconstruct a partial tree from a
// subset of matches.
export function AccountTreeView() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const perms: TreeRowPerms = {
    canUpdate: permissionsLoading || hasPermission('chart_of_account', 'update'),
    canCreate: permissionsLoading || hasPermission('chart_of_account', 'create'),
    canDelete: permissionsLoading || hasPermission('chart_of_account', 'delete'),
  };
  // Reshaping the chart itself (adding or renaming a category / sub-category)
  // is :configure, the same grant account-defaults uses — not :update, which
  // governs the accounts filed inside it.
  const canConfigure = permissionsLoading || hasPermission('chart_of_account', 'configure');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [taxonomy, setTaxonomy] = useState<TaxonomyIntent | null>(null);
  const [announcement, setAnnouncement] = useState('');

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

  // `sections` is the watch target: it's a fresh array reference every time
  // the tree refetches, which is exactly the signal the hook needs to know
  // the just-created row might exist now. The row usually isn't there yet on
  // the render right after create — the mutation's invalidateQueries only
  // just kicked off the background refetch.
  const { highlightedId, markCreated } = useHighlightOnCreate(accountRowDomId, sections);

  // Fires for both a top-level create and a sub-account create, never edit —
  // an edited account is already visible wherever the user opened it from.
  function handleAccountCreated(account: Account) {
    setDrawer(null);
    // A create can be opened while a search is active (the row-level "add
    // sub-account" button renders in search results too). Clearing it here
    // guarantees the new account is reachable: the search query isn't part of
    // the ['coa-tree', ...] invalidation the create mutation fires, so it
    // wouldn't pick up the new row on its own, and there'd be nothing to
    // scroll to.
    setTerm('');
    setDebounced('');
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const key of ancestorKeysFor(account)) next.delete(key);
      return next;
    });
    markCreated(account.id);
    setAnnouncement(`${account.code} ${account.name} created.`);
  }

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

  const rowActions: TreeRowActions = {
    onToggleSelect: toggleSelect,
    onEdit: (account) => setDrawer({ mode: 'edit', account }),
    onAddSubAccount: (account) => setDrawer({ mode: 'create-child', parent: toParentRef(account) }),
  };

  // groupKey is recomputed rather than carried on TaxonomyGroup: the same
  // category can legitimately appear under both sections (a MIXED one), so a
  // collapse key has to include the section it was rendered in.
  const groupActions = (sectionKey: string) => ({
    onToggle: (g: TaxonomyGroup) => toggleCollapse(groupKey(g, sectionKey)),
    onRename: (g: TaxonomyGroup) => setTaxonomy({
      kind: 'rename', target: g.level, id: g.id, code: g.code, currentName: g.name,
    }),
    onAddSubCategory: (g: TaxonomyGroup) => setTaxonomy({
      kind: 'create-subcategory', parentId: g.id, parentLabel: `${g.code} — ${g.name}`,
    }),
    // Opening from a group header is a shortcut into the same create form,
    // not a separate flow — but it pre-selects the placement the user just
    // clicked on rather than handing back the same empty dropdown.
    onAddAccount: (g: TaxonomyGroup) => setDrawer({
      mode: 'create',
      initialPlacement: { kind: g.level, id: g.id },
      initialPlacementLabel: `${g.code} — ${g.name}`,
    }),
  });

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="sr-only">{announcement}</p>

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

        {!debounced && sections.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setCollapsed(new Set())}
              aria-label="Expand all sections and categories"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <ChevronsDown className="size-3.5" /> Expand All
            </button>
            <span className="text-stone-300" aria-hidden="true">|</span>
            <button
              type="button"
              onClick={() => setCollapsed(new Set(allGroupKeys(sections)))}
              aria-label="Collapse all sections and categories"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              <ChevronsUp className="size-3.5" /> Collapse All
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canConfigure && (
            <button
              type="button"
              onClick={() => setTaxonomy({ kind: 'create-category' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white py-1.5 px-3 text-xs font-semibold text-stone-600 shadow-sm transition hover:bg-stone-50 active:scale-95"
            >
              <FolderPlus className="size-3.5" />
              New Category
            </button>
          )}
          {perms.canCreate && (
            <button
              type="button"
              onClick={() => setDrawer({ mode: 'create' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-1.5 px-3 text-xs font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Account
            </button>
          )}
        </div>
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
            <HighlightedAccountContext.Provider value={highlightedId}>
              {searchPage?.records.map((a) => (
                <AccountTreeRow
                  key={a.id}
                  account={{ ...a, children: [] }}
                  depth={a.depth}
                  perms={perms}
                  actions={rowActions}
                  selectedIds={selectedIds}
                />
              ))}
            </HighlightedAccountContext.Provider>
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
        <HighlightedAccountContext.Provider value={highlightedId}>
        {sections.map((section) => {
          const secKey = `sec-${section.bsPnl}`;
          const secCollapsed = collapsed.has(secKey);
          const headerActions = groupActions(section.bsPnl);
          return (
            <div key={section.bsPnl} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleCollapse(secKey)}
                aria-expanded={!secCollapsed}
                className="flex w-full items-center gap-1.5 rounded-t-xl bg-stone-50/60 px-4 py-3 border-b border-stone-100 hover:bg-stone-50"
              >
                {secCollapsed ? <ChevronRight className="size-3.5 text-stone-400" /> : <ChevronDown className="size-3.5 text-stone-400" />}
                <span className="text-sm font-bold text-stone-900">{section.label}</span>
              </button>

              {!secCollapsed && (
                <div className="px-2 py-2">
                  {section.categories.map((cat) => {
                    const catGroup: TaxonomyGroup = {
                      level: 'category', id: cat.id, code: cat.code, name: cat.name,
                    };
                    const catKey = groupKey(catGroup, section.bsPnl);
                    const catCollapsed = collapsed.has(catKey);
                    return (
                      <div key={catKey} className="py-1">
                        <TaxonomyGroupHeader
                          group={catGroup}
                          collapsed={catCollapsed}
                          perms={{ canConfigure, canCreate: perms.canCreate }}
                          actions={headerActions}
                        />

                        {!catCollapsed && (
                          <div className="ml-4 space-y-1">
                            {/* Accounts filed on the category itself, above its
                                sub-categories — the placement that used to be
                                unreachable. */}
                            {cat.accounts.map((acct) => (
                              <AccountTreeRow
                                key={acct.id}
                                account={acct}
                                perms={perms}
                                actions={rowActions}
                                selectedIds={selectedIds}
                              />
                            ))}

                            {cat.subCategories.map((sub) => {
                              const subGroup: TaxonomyGroup = {
                                level: 'subcategory', id: sub.id, code: sub.code, name: sub.name,
                              };
                              const subKey = groupKey(subGroup, section.bsPnl);
                              const subCollapsed = collapsed.has(subKey);
                              return (
                                <div key={subKey}>
                                  <TaxonomyGroupHeader
                                    group={subGroup}
                                    collapsed={subCollapsed}
                                    perms={{ canConfigure, canCreate: perms.canCreate }}
                                    actions={headerActions}
                                  />

                                  {!subCollapsed && (
                                    sub.accounts.length === 0 ? (
                                      <p className="pl-8 py-1 text-2xs italic text-stone-300">No accounts yet.</p>
                                    ) : (
                                      <div>
                                        {sub.accounts.map((acct) => (
                                          <AccountTreeRow
                                            key={acct.id}
                                            account={acct}
                                            perms={perms}
                                            actions={rowActions}
                                            selectedIds={selectedIds}
                                          />
                                        ))}
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })}

                            {cat.accounts.length === 0 && cat.subCategories.length === 0 && (
                              <p className="pl-2 py-1 text-2xs italic text-stone-300">
                                Nothing under this category yet.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </HighlightedAccountContext.Provider>
      )}

      {drawer?.mode === 'create' && (
        <AccountFormDrawer
          onClose={() => setDrawer(null)}
          onSaved={handleAccountCreated}
          initialPlacement={drawer.initialPlacement}
          initialPlacementLabel={drawer.initialPlacementLabel}
        />
      )}
      {drawer?.mode === 'create-child' && (
        <AccountFormDrawer onClose={() => setDrawer(null)} onSaved={handleAccountCreated} parent={drawer.parent} />
      )}
      {drawer?.mode === 'edit' && (
        <AccountFormDrawer onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} account={drawer.account} />
      )}

      {taxonomy && (
        <TaxonomyFormDialog intent={taxonomy} onClose={() => setTaxonomy(null)} />
      )}
    </div>
  );
}

// The collapse key for one group as rendered inside one section. Must stay in
// step with allGroupKeys, which builds the same keys for "Collapse All".
function groupKey(group: TaxonomyGroup, sectionKey: string): string {
  return `${group.level === 'category' ? 'cat' : 'sub'}-${group.id}-${sectionKey}`;
}

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { EMPTY_ACCOUNT_TABLE_FILTER_STATE, type AccountTableFilterState } from '@/lib/coaFilters';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '@/types/chartOfAccounts';

// Filter drawer for the Chart of Accounts table view — mirrors
// ItemReceiptFilterDrawer's "mount only while open" pattern. Does not offer
// active/visible/postable — the table view's Include-inactive/Include-hidden
// switches already cover those via the same query-param toggles the tree
// view uses.
export function AccountFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: AccountTableFilterState;
  onApply: (next: AccountTableFilterState) => void;
}) {
  const [draft, setDraft] = useState<AccountTableFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { data: categoryData } = useQuery({
    queryKey: ['coa-categories'],
    queryFn: chartOfAccountsService.getCategories,
    staleTime: 10 * 60 * 1000,
  });

  const set = <K extends keyof AccountTableFilterState>(key: K, val: AccountTableFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const subCategoryOptions = draft.categoryCode
    ? (categoryData?.subCategories ?? []).filter((s) => s.categoryCode === draft.categoryCode)
    : categoryData?.subCategories ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coa-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="coa-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scrollbar px-4 py-4 space-y-5">
          <FilterField label="Type">
            <select
              value={draft.type}
              onChange={(e) => set('type', e.target.value as AccountTableFilterState['type'])}
              className={fieldCls}
              aria-label="Type"
            >
              <option value="">— Any —</option>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
            </select>
          </FilterField>

          <FilterField label="Balance Sheet / P&L">
            <select
              value={draft.bsPnl}
              onChange={(e) => set('bsPnl', e.target.value as AccountTableFilterState['bsPnl'])}
              className={fieldCls}
              aria-label="Balance Sheet or P&L"
            >
              <option value="">— Any —</option>
              <option value="BS">Balance Sheet</option>
              <option value="PNL">Profit &amp; Loss</option>
            </select>
          </FilterField>

          <FilterField label="Category">
            <select
              value={draft.categoryCode}
              onChange={(e) => {
                set('categoryCode', e.target.value ? Number(e.target.value) : '');
                set('subCategoryCode', '');
              }}
              className={fieldCls}
              aria-label="Category"
            >
              <option value="">— Any —</option>
              {categoryData?.categories.map((c) => <option key={c.id} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </FilterField>

          <FilterField label="Sub-category">
            <select
              value={draft.subCategoryCode}
              onChange={(e) => set('subCategoryCode', e.target.value ? Number(e.target.value) : '')}
              className={fieldCls}
              aria-label="Sub-category"
            >
              <option value="">— Any —</option>
              {subCategoryOptions.map((s) => <option key={s.id} value={s.code}>{s.code} — {s.name}</option>)}
            </select>
          </FilterField>

          <FilterField label="System Accounts">
            <select
              value={draft.isSystem}
              onChange={(e) => set('isSystem', e.target.value as AccountTableFilterState['isSystem'])}
              className={fieldCls}
              aria-label="System accounts"
            >
              <option value="">— Any —</option>
              <option value="true">Seeded (system) only</option>
              <option value="false">User-created only</option>
            </select>
          </FilterField>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-4 py-3 shrink-0">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_ACCOUNT_TABLE_FILTER_STATE)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => { onApply(draft); onClose(); }}
            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover transition-colors shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={fieldLabelCls}>{label}</label>
      {children}
    </div>
  );
}

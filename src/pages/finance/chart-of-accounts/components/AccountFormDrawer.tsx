import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useScrollToError } from '@/hooks/useScrollToError';
import { fieldCls, fieldErrorCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { parseCoaError } from '@/lib/coaErrors';
import { attrFieldsFor, missingRequiredAttrs, ACCOUNT_NUMBER_LAST4_KEY } from '@/lib/coaAttributes';
import {
  placementFromSelection, placementPayload, requiresExplicitSide, sideForPlacement,
  type Placement,
} from '@/lib/coaPlacement';
import { AccountAttributeFields } from './AccountAttributeFields';
import {
  ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS,
  type Account, type AccountType, type BSPNL,
} from '@/types/chartOfAccounts';

/** Where a sub-account's parent sits, so the drawer can show the inherited
 *  placement and resolve the category side without refetching the parent. */
export interface AccountParentRef {
  id: string;
  code: string;
  name: string;
  placement: Placement;
  placementLabel: string;
}

interface AccountFormDrawerProps {
  onClose: () => void;
  onSaved: (account: Account) => void;
  /** Present when editing an existing account; omit to create a new one. */
  account?: Account;
  /** Present when creating a sub-account under a depth-0 row — the child
   *  inherits the parent's sub-category and gets no selector of its own (AD-5). */
  parent?: AccountParentRef;
  /** Pre-selects the placement picker when the drawer is opened from a
   *  category/sub-category's own inline "+" — the user already told us where
   *  the account goes by clicking there, so making them pick it again from an
   *  empty dropdown is a redundant, annoying step. Still changeable; ignored
   *  once `parent` or `account` is set (both have their own placement).
   *  `initialPlacementLabel` only feeds the drawer title, matching how
   *  `parent.placementLabel` is used for the sub-account title below. */
  initialPlacement?: Placement;
  initialPlacementLabel?: string;
}

function initialAttrDraft(type: AccountType, attrs: Record<string, string>): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const f of attrFieldsFor(type)) {
    if (f.writeOnly) continue; // never prefill the bank account number
    if (attrs[f.key]) draft[f.key] = attrs[f.key];
  }
  return draft;
}

// Create and edit share one drawer. Deliberately excludes isActive/isVisible —
// those go through the dedicated visibility actions (coaVisibility.ts) on
// each row, which is the only place that can guarantee chk_coa_visibility is
// never violated; folding them into a generic form would reopen that risk.
export function AccountFormDrawer({
  onClose, onSaved, account, parent, initialPlacement, initialPlacementLabel,
}: AccountFormDrawerProps) {
  const isEdit = Boolean(account);
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();

  const [name, setName] = useState(account?.name ?? '');
  const [description, setDescription] = useState(account?.description ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'general');
  const [isPostable, setIsPostable] = useState(account?.isPostable ?? true);
  // Split into two selects instead of one combined "Placement" dropdown. A
  // sub-category-level initialPlacement (from the tree's "+" on a
  // sub-category row) only carries a sub-category id — its category id gets
  // filled in by the hydration effect below once the reference tree loads.
  const [categoryId, setCategoryId] = useState<number | null>(
    initialPlacement?.kind === 'category' ? initialPlacement.id : null,
  );
  const [subCategoryId, setSubCategoryId] = useState<number | null>(
    initialPlacement?.kind === 'subcategory' ? initialPlacement.id : null,
  );
  const [bsPnl, setBsPnl] = useState<BSPNL | ''>('');
  const [attrs, setAttrs] = useState<Record<string, string>>(
    account ? initialAttrDraft(account.type, account.attributes) : {},
  );
  const [attrsTouched, setAttrsTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Every create needs the reference tree: a top-level one to render the
  // placement picker, a sub-account one to resolve whether its inherited
  // category is MIXED and therefore needs an explicit side.
  const { data: categoryData } = useQuery({
    queryKey: ['coa-categories'],
    queryFn: chartOfAccountsService.getCategories,
    staleTime: 10 * 60 * 1000,
    enabled: !isEdit,
  });

  // Resolves the sub-category-only initialPlacement case above: derived at
  // render time from whichever sub-category is currently picked, rather than
  // synced into state via an effect, so it's correct on the very first paint
  // once the reference tree arrives (and stays correct if the user picks a
  // different sub-category under the same category without ever touching
  // the Category select directly).
  const inferredCategoryId = subCategoryId === null
    ? null
    : categoryData?.subCategories.find((s) => s.id === subCategoryId)?.categoryId ?? null;
  const effectiveCategoryId = categoryId ?? inferredCategoryId;

  const placement = placementFromSelection(effectiveCategoryId, subCategoryId);
  const effectivePlacement = parent?.placement ?? placement;
  const side = sideForPlacement(
    effectivePlacement, categoryData?.categories ?? [], categoryData?.subCategories ?? [],
  );
  const needsBsPnl = !isEdit && requiresExplicitSide(side);
  const subCategoryOptions = categoryData?.subCategories.filter((s) => s.categoryId === effectiveCategoryId) ?? [];

  function handleTypeChange(next: AccountType) {
    setType(next);
    setAttrs({});
    setAttrsTouched(true);
  }

  function handleAttrsChange(next: Record<string, string>) {
    setAttrs(next);
    setAttrsTouched(true);
  }

  const currentLast4 = account?.attributes[ACCOUNT_NUMBER_LAST4_KEY];

  const save = useMutation({
    mutationFn: () => {
      if (isEdit && account) {
        return chartOfAccountsService.updateAccount(account.id, {
          name: name.trim(),
          description: description.trim(),
          type,
          ...(attrsTouched ? { attributes: attrs } : {}),
          isPostable,
          recordVersion: account.recordVersion,
        });
      }
      return chartOfAccountsService.createAccount({
        name: name.trim(),
        description: description.trim(),
        // A sub-account sends only parentId: the server copies the parent's
        // placement, and echoing a placement that disagrees with it is a 400.
        ...(parent ? { parentId: parent.id } : placement ? placementPayload(placement) : {}),
        ...(needsBsPnl && bsPnl ? { bsPnl } : {}),
        type,
        attributes: attrs,
        isPostable,
      });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
      queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
      if (isEdit && account) queryClient.invalidateQueries({ queryKey: ['coa-account', account.id] });
      onSaved(saved);
    },
  });
  const errorRef = useScrollToError<HTMLDivElement>(save.error);

  const errorInfo = save.error
    ? parseCoaError(save.error, isEdit ? 'Failed to save account.' : 'Failed to create account.')
    : null;
  const missingAttrs = missingRequiredAttrs(type, attrs);
  const missingPlacement = !isEdit && !parent && !placement;
  const missingBsPnl = needsBsPnl && !bsPnl;

  function handleSubmit() {
    if (!name.trim() || missingPlacement || missingBsPnl || missingAttrs.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    save.mutate();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-form-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div>
            <h2 id="account-form-drawer-title" className="text-sm font-bold text-stone-900">
              {isEdit
                ? 'Edit Account'
                : parent
                  ? `Add Sub-account under ${parent.code}`
                  : initialPlacementLabel
                    ? `New Account under ${initialPlacementLabel}`
                    : 'New Account'}
            </h2>
            {isEdit && account && <p className="text-2xs text-stone-400 font-mono mt-0.5">{account.code}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorInfo && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="shrink-0 flex items-start gap-2.5 border-b border-red-200 bg-red-50 px-4 py-2.5 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-inset"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" />
            <div className="text-xs text-red-700">
              <p>{errorInfo.message}</p>
              {errorInfo.kind === 'versionConflict' && account && (
                <button
                  type="button"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['coa-account', account.id] });
                    onClose();
                  }}
                  className="mt-1 font-semibold underline"
                >
                  Close and reload the latest version
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto modal-scrollbar px-4 py-4 space-y-4">
          {isEdit && account && (
            <ModernFieldShell label="Code">
              <div className={readonlyCls}>{account.code}</div>
            </ModernFieldShell>
          )}

          {parent && (
            <ModernFieldShell label="Placement">
              <div className={readonlyCls}>
                {parent.placementLabel} (inherited from {parent.code})
              </div>
            </ModernFieldShell>
          )}

          {!isEdit && !parent && (
            <>
              <ModernFieldShell label="Category" required>
                <select
                  value={effectiveCategoryId ?? ''}
                  onChange={(e) => {
                    const next = e.target.value ? Number(e.target.value) : null;
                    setCategoryId(next);
                    setSubCategoryId(null);
                    setBsPnl('');
                  }}
                  className={showErrors && missingPlacement ? fieldErrorCls : fieldCls}
                  aria-label="Category"
                  aria-required="true"
                  aria-invalid={(showErrors && missingPlacement) || undefined}
                  aria-describedby={showErrors && missingPlacement ? 'category-error' : undefined}
                >
                  <option value="">— Select —</option>
                  {categoryData?.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.code} — {cat.name}</option>
                  ))}
                </select>
                {showErrors && missingPlacement && (
                  <p id="category-error" className="text-2xs text-destructive">
                    A category is required.
                  </p>
                )}
              </ModernFieldShell>

              <ModernFieldShell label="Sub-category">
                {/* Placing an account directly under a category (no
                    sub-category) is a deliberate, supported choice, not a
                    lesser default — it's the first option, not an
                    afterthought once sub-categories are listed. */}
                <select
                  value={subCategoryId ?? ''}
                  onChange={(e) => setSubCategoryId(e.target.value ? Number(e.target.value) : null)}
                  disabled={effectiveCategoryId === null}
                  className={fieldCls}
                  aria-label="Sub-category"
                >
                  <option value="">
                    {effectiveCategoryId === null ? '— Select a category first —' : '— None (place directly under category) —'}
                  </option>
                  {subCategoryOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </ModernFieldShell>
            </>
          )}

          {needsBsPnl && (
            <ModernFieldShell label="Balance Sheet or P&L" required>
              <div
                className="flex gap-3"
                role="radiogroup"
                aria-label="Balance Sheet or P&L"
                aria-required="true"
                aria-invalid={(showErrors && missingBsPnl) || undefined}
                aria-describedby={showErrors && missingBsPnl ? 'bspnl-error' : undefined}
              >
                {(['BS', 'PNL'] as const).map((side) => (
                  <label key={side} className="flex items-center gap-1.5 text-xs text-stone-700">
                    <input type="radio" name="bsPnl" value={side} checked={bsPnl === side} onChange={() => setBsPnl(side)} />
                    {side === 'BS' ? 'Balance Sheet' : 'Profit & Loss'}
                  </label>
                ))}
              </div>
              {showErrors && missingBsPnl && (
                <p id="bspnl-error" className="text-2xs text-destructive">
                  This category holds both balance-sheet and P&L accounts — pick one.
                </p>
              )}
            </ModernFieldShell>
          )}

          <ModernFieldShell label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={showErrors && !name.trim() ? fieldErrorCls : fieldCls}
              aria-label="Account name"
              aria-required="true"
              aria-invalid={(showErrors && !name.trim()) || undefined}
              aria-describedby={showErrors && !name.trim() ? 'account-name-error' : undefined}
            />
            {showErrors && !name.trim() && (
              <p id="account-name-error" className="text-2xs text-destructive">An account name is required.</p>
            )}
          </ModernFieldShell>

          <ModernFieldShell label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={textareaCls}
              aria-label="Description"
            />
          </ModernFieldShell>

          <ModernFieldShell label="Type" required>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as AccountType)}
              className={fieldCls}
              aria-label="Account type"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </ModernFieldShell>

          <AccountAttributeFields
            type={type}
            value={attrs}
            onChange={handleAttrsChange}
            currentLast4={type === 'bank' ? currentLast4 : undefined}
            showErrors={showErrors}
          />

          <label className="flex items-center gap-2 text-xs text-stone-700">
            <input type="checkbox" checked={isPostable} onChange={(e) => setIsPostable(e.target.checked)} />
            Postable (accepts transactions directly)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-4 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors shadow-sm"
          >
            {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {save.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

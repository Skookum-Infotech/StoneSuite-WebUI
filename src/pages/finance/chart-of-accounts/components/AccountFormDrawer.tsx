import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldErrorCls, textareaCls, readonlyCls } from '@/components/crm/formUtils';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { parseCoaError } from '@/lib/coaErrors';
import { attrFieldsFor, missingRequiredAttrs, ACCOUNT_NUMBER_LAST4_KEY } from '@/lib/coaAttributes';
import { AccountAttributeFields } from './AccountAttributeFields';
import {
  ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, MIXED_SUBCATEGORY_CODE,
  type Account, type AccountType, type BSPNL,
} from '@/types/chartOfAccounts';

export interface AccountParentRef {
  id: string;
  code: string;
  name: string;
  subCategoryId: number;
  subCategoryCode: number;
  subCategoryName: string;
}

interface AccountFormDrawerProps {
  onClose: () => void;
  onSaved: (account: Account) => void;
  /** Present when editing an existing account; omit to create a new one. */
  account?: Account;
  /** Present when creating a sub-account under a depth-0 row — the child
   *  inherits the parent's sub-category and gets no selector of its own (AD-5). */
  parent?: AccountParentRef;
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
export function AccountFormDrawer({ onClose, onSaved, account, parent }: AccountFormDrawerProps) {
  const isEdit = Boolean(account);
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();

  const [name, setName] = useState(account?.name ?? '');
  const [description, setDescription] = useState(account?.description ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'general');
  const [isPostable, setIsPostable] = useState(account?.isPostable ?? true);
  const [subCategoryId, setSubCategoryId] = useState<number | ''>('');
  const [bsPnl, setBsPnl] = useState<BSPNL | ''>('');
  const [attrs, setAttrs] = useState<Record<string, string>>(
    account ? initialAttrDraft(account.type, account.attributes) : {},
  );
  const [attrsTouched, setAttrsTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const { data: categoryData } = useQuery({
    queryKey: ['coa-categories'],
    queryFn: chartOfAccountsService.getCategories,
    staleTime: 10 * 60 * 1000,
    enabled: !isEdit && !parent, // only a top-level create needs the sub-category picker
  });

  const selectedSubCategory = categoryData?.subCategories.find((s) => s.id === subCategoryId);
  const effectiveSubCategoryCode = parent?.subCategoryCode ?? selectedSubCategory?.code;
  const needsBsPnl = !isEdit && effectiveSubCategoryCode === MIXED_SUBCATEGORY_CODE;

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
        ...(parent ? { parentId: parent.id } : { subCategoryId: subCategoryId || undefined }),
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

  const errorInfo = save.error
    ? parseCoaError(save.error, isEdit ? 'Failed to save account.' : 'Failed to create account.')
    : null;
  const missingAttrs = missingRequiredAttrs(type, attrs);
  const missingSubCategory = !isEdit && !parent && !subCategoryId;
  const missingBsPnl = needsBsPnl && !bsPnl;

  function handleSubmit() {
    if (!name.trim() || missingSubCategory || missingBsPnl || missingAttrs.length > 0) {
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
              {isEdit ? 'Edit Account' : parent ? `Add Sub-account under ${parent.code}` : 'New Account'}
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
          <div role="alert" className="shrink-0 flex items-start gap-2.5 border-b border-red-200 bg-red-50 px-4 py-2.5">
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
            <ModernFieldShell label="Sub-category">
              <div className={readonlyCls}>
                {parent.subCategoryCode} — {parent.subCategoryName} (inherited from {parent.code})
              </div>
            </ModernFieldShell>
          )}

          {!isEdit && !parent && (
            <ModernFieldShell label="Sub-category" required>
              <select
                value={subCategoryId}
                onChange={(e) => {
                  setSubCategoryId(e.target.value ? Number(e.target.value) : '');
                  setBsPnl('');
                }}
                className={showErrors && missingSubCategory ? fieldErrorCls : fieldCls}
                aria-label="Sub-category"
                aria-required="true"
                aria-invalid={(showErrors && missingSubCategory) || undefined}
                aria-describedby={showErrors && missingSubCategory ? 'subcategory-error' : undefined}
              >
                <option value="">— Select —</option>
                {categoryData?.categories.map((cat) => (
                  <optgroup key={cat.id} label={`${cat.code} ${cat.name}`}>
                    {categoryData.subCategories
                      .filter((s) => s.categoryId === cat.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {showErrors && missingSubCategory && (
                <p id="subcategory-error" className="text-2xs text-destructive">A sub-category is required.</p>
              )}
            </ModernFieldShell>
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
                  Sub-category {MIXED_SUBCATEGORY_CODE} holds both balance-sheet and P&L accounts — pick one.
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

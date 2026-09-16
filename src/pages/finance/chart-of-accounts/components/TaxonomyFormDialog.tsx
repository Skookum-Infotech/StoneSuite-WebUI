import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Save, X } from 'lucide-react';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldErrorCls, readonlyCls } from '@/components/crm/formUtils';
import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { parseCoaError } from '@/lib/coaErrors';
import {
  MIXED_SIDE, NORMAL_BALANCES,
  type CategorySide, type NormalBalance,
} from '@/types/chartOfAccounts';

/** What the dialog is being opened to do. A tagged union rather than four
 *  near-identical dialogs: the four operations differ only in which fields show
 *  and which service call fires, and splitting them would mean four copies of
 *  the same portal/focus-trap/error shell. */
export type TaxonomyIntent =
  | { kind: 'create-category' }
  | { kind: 'create-subcategory'; parentId: number; parentLabel: string }
  | { kind: 'rename'; target: 'category' | 'subcategory'; id: number; code: number; currentName: string };

const SIDE_OPTIONS: { value: CategorySide; label: string; hint: string }[] = [
  { value: 'BS', label: 'Balance Sheet', hint: 'Assets, liabilities, equity' },
  { value: 'PNL', label: 'Profit & Loss', hint: 'Revenue, cost, expenses' },
  { value: MIXED_SIDE, label: 'Mixed', hint: 'Each account picks its own side' },
];

const NORMAL_BALANCE_LABELS: Record<NormalBalance, string> = {
  debit: 'Debit',
  credit: 'Credit',
};

function titleFor(intent: TaxonomyIntent): string {
  switch (intent.kind) {
    case 'create-category':
      return 'New Category';
    case 'create-subcategory':
      return `New Sub-category under ${intent.parentLabel}`;
    case 'rename':
      return intent.target === 'category' ? 'Rename Category' : 'Rename Sub-category';
  }
}

function fallbackErrorFor(intent: TaxonomyIntent): string {
  switch (intent.kind) {
    case 'create-category':
      return 'Failed to create the category.';
    case 'create-subcategory':
      return 'Failed to create the sub-category.';
    case 'rename':
      return 'Failed to rename.';
  }
}

// Create or rename a category / sub-category. Codes and ranges are deliberately
// absent from this form: the server allocates the next free block, and an
// existing code can never change because every account code inside the range
// was allocated against it.
export function TaxonomyFormDialog({ intent, onClose }: {
  intent: TaxonomyIntent;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();

  const [name, setName] = useState(intent.kind === 'rename' ? intent.currentName : '');
  const [side, setSide] = useState<CategorySide>('BS');
  const [normalBalance, setNormalBalance] = useState<NormalBalance>('debit');
  const [showErrors, setShowErrors] = useState(false);

  // Returns void rather than the saved row: the four calls return two
  // different shapes, and nothing here reads either — onSuccess refetches.
  const save = useMutation<void, Error, void>({
    mutationFn: async () => {
      const trimmed = name.trim();
      switch (intent.kind) {
        case 'create-category':
          await chartOfAccountsService.createCategory({
            name: trimmed, bsPnl: side, normalBalance,
          });
          return;
        case 'create-subcategory':
          await chartOfAccountsService.createSubCategory({
            categoryId: intent.parentId, name: trimmed,
          });
          return;
        case 'rename':
          await (intent.target === 'category'
            ? chartOfAccountsService.renameCategory(intent.id, { name: trimmed })
            : chartOfAccountsService.renameSubCategory(intent.id, { name: trimmed }));
      }
    },
    onSuccess: () => {
      // The tree renders category and sub-category names, the reference tree
      // feeds the placement picker, and a flat account row carries its
      // category/sub-category name too — all three go stale on any of these.
      queryClient.invalidateQueries({ queryKey: ['coa-tree'] });
      queryClient.invalidateQueries({ queryKey: ['coa-categories'] });
      queryClient.invalidateQueries({ queryKey: ['coa-accounts'] });
      onClose();
    },
  });

  const errorInfo = save.error ? parseCoaError(save.error, fallbackErrorFor(intent)) : null;
  const missingName = !name.trim();

  function handleSubmit() {
    if (missingName) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    save.mutate();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="taxonomy-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl outline-none">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="taxonomy-dialog-title" className="text-sm font-bold text-stone-900">
            {titleFor(intent)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorInfo && (
          <div role="alert" className="mb-3 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" />
            <p className="text-xs text-red-700">{errorInfo.message}</p>
          </div>
        )}

        <div className="space-y-4">
          {intent.kind === 'rename' && (
            <ModernFieldShell label="Code">
              <div className={readonlyCls}>{intent.code}</div>
            </ModernFieldShell>
          )}

          <ModernFieldShell label="Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={showErrors && missingName ? fieldErrorCls : fieldCls}
              aria-label="Name"
              aria-required="true"
              aria-invalid={(showErrors && missingName) || undefined}
              aria-describedby={showErrors && missingName ? 'taxonomy-name-error' : undefined}
            />
            {showErrors && missingName && (
              <p id="taxonomy-name-error" className="text-2xs text-destructive">A name is required.</p>
            )}
          </ModernFieldShell>

          {intent.kind === 'create-category' && (
            <>
              <ModernFieldShell label="Reports under" required>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as CategorySide)}
                  className={fieldCls}
                  aria-label="Reports under"
                >
                  {SIDE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>
                  ))}
                </select>
              </ModernFieldShell>

              <ModernFieldShell label="Normal balance" required>
                <select
                  value={normalBalance}
                  onChange={(e) => setNormalBalance(e.target.value as NormalBalance)}
                  className={fieldCls}
                  aria-label="Normal balance"
                >
                  {NORMAL_BALANCES.map((b) => (
                    <option key={b} value={b}>{NORMAL_BALANCE_LABELS[b]}</option>
                  ))}
                </select>
              </ModernFieldShell>

              <p className="text-2xs text-stone-400">
                The code and range are assigned automatically from the next free block, and cannot
                be changed later.
              </p>
            </>
          )}

          {intent.kind === 'create-subcategory' && (
            <p className="text-2xs text-stone-400">
              The code and range are assigned automatically from the next free block under{' '}
              {intent.parentLabel}. It reports on the same side as its category.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={save.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {save.isPending ? 'Saving…' : intent.kind === 'rename' ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

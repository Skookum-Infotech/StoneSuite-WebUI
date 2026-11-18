import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';

import { buttonVariants } from '@/components/ui/button';
// Renders a 409 that carries blockingSlots (AD-7) — naming the default-slot(s)
// pointing at the account and deep-linking to Default Accounts so the user
// can repoint first, then retry. Used for both single-row and bulk actions.
export function BlockingSlotsDialog({
  message,
  slots,
  onClose,
}: {
  message: string;
  slots: string[];
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);

  const { data: defaults = [] } = useQuery({
    queryKey: ['coa-defaults'],
    queryFn: chartOfAccountsService.getDefaults,
    staleTime: 60 * 1000,
  });
  const labelFor = (key: string) => defaults.find((s) => s.key === key)?.label ?? key;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocking-slots-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="size-4 text-warning-ink" aria-hidden="true" />
          </div>
          <div>
            <h3 id="blocking-slots-dialog-title" className="type-card-title">
              Account in Use as a Default
            </h3>
            <p className="mt-0.5 type-helper">Point the default at another account first.</p>
          </div>
        </div>

        <p className="text-xs text-ink mb-3">{message}</p>

        <ul className="mb-4 space-y-1">
          {slots.map((key) => (
            <li key={key} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
              {labelFor(key)}
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={buttonVariants({ variant: 'outline' })}
          >
            Close
          </button>
          <Link
            to={`/finance/account-defaults#slot-${slots[0]}`}
            onClick={onClose}
            className={buttonVariants()}
          >
            Repoint defaults
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { FilePlus, Loader2, PackagePlus, Send, ShieldCheck } from 'lucide-react';
import { isPoTransitionBlocked, poHeaderTransitions, poTransitionLabel } from '@/lib/purchaseOrderForm';

const BLOCKED_REASON = 'Awaiting approval sign-off';

const SECONDARY_BTN =
  'inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed';
const PRIMARY_BTN =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed';

// The Purchase Order Detail page's header buttons: Receive items and Create
// Bill, plus the two forward status moves (Submit for Approval, Send to
// Vendor) that used to sit in the status dropdown. The status moves are the
// ones the backend lets any purchase_order:transition holder request; every
// other status change is a super-admin dropdown option. Rendered as a fragment
// so the buttons are direct children of CrmPageHeader's actions wrapper (its
// mobile sizing targets them).
export function PurchaseOrderHeaderActions({ order, canTransition, onTransition, transitioning, actions }: {
  order: { statusCode: string; approvalStatus: string; gated?: boolean; nextStatusCodes?: string[] };
  canTransition: boolean;
  onTransition: (code: string) => void;
  transitioning: boolean;
  /** Each button appears only when its handler is passed — the page decides
   *  whether the user may, and the order can, receive items or be billed. */
  actions: { onReceive?: () => void; onCreateBill?: () => void };
}) {
  const transitions = canTransition ? poHeaderTransitions(order) : [];

  return (
    <>
      {actions.onReceive && (
        <button type="button" onClick={actions.onReceive} aria-label="Receive items" className={SECONDARY_BTN}>
          <PackagePlus className="size-3.5" aria-hidden="true" />
          Receive items
        </button>
      )}
      {actions.onCreateBill && (
        <button type="button" onClick={actions.onCreateBill} aria-label="Create Bill" className={SECONDARY_BTN}>
          <FilePlus className="size-3.5" aria-hidden="true" />
          Create Bill
        </button>
      )}
      {transitions.map((code) => {
        const label = poTransitionLabel(order.statusCode, code);
        const blocked = isPoTransitionBlocked(code, order.approvalStatus, order.gated);
        const Icon = code === 'SENT' ? Send : ShieldCheck;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onTransition(code)}
            disabled={blocked || transitioning}
            title={blocked ? BLOCKED_REASON : undefined}
            aria-label={label}
            className={PRIMARY_BTN}
          >
            {transitioning ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Icon className="size-3.5" aria-hidden="true" />}
            {label}
          </button>
        );
      })}
    </>
  );
}

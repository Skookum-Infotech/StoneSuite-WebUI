import { useNavigate } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import type { VendorPaymentRefund } from '@/types/vendorPayment';

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Money the vendor sent back against a bill this payment settled (backend
// AD-5). Deliberately read-only: vendorpayment.RecordRefund/RemoveRefund exist
// in the store but no controller or route exposes them yet, so refunds can
// only be read — they arrive on the payment's GET response and reduce its
// applied total. Once those endpoints land, a Record Refund dialog belongs
// here alongside a per-row Remove, mirroring the applications tab.
export function VendorPaymentRefundsTab({ refunds }: { refunds: VendorPaymentRefund[] }) {
  const navigate = useNavigate();

  if (refunds.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Undo2 className="size-6 text-stone-300" aria-hidden="true" />
        <p className="text-sm text-stone-400">No refunds recorded against this payment.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr className="divide-x divide-stone-200">
            {['Bill #', 'Amount', 'Reason', 'Reference #', 'Memo', 'Refunded On'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {refunds.map((refund) => (
            <tr key={refund.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
              <td className="px-3 py-2.5 font-medium text-stone-800">
                <button
                  type="button"
                  onClick={() => navigate(`/purchases/vendor_bill/${refund.vendorBillId}`)}
                  className="hover:text-accent-foreground transition-colors"
                >
                  {refund.vendorBillNumber || '—'}
                </button>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-stone-700">{currency(refund.amount)}</td>
              <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{refund.reason || '—'}</td>
              <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{refund.referenceNumber || '—'}</td>
              <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{refund.memo || '—'}</td>
              <td className="px-3 py-2.5 tabular-nums text-stone-400 whitespace-nowrap">{fmtDate(refund.refundedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

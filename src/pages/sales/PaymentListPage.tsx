import { useNavigate } from 'react-router-dom';
import { CreditCard, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { PaymentTable } from './components/PaymentTable';

export default function PaymentListPage() {
  const navigate = useNavigate();
  // A customer-portal session reads this same page (see CLAUDE.md's
  // merged-login design) but never records a payment — the backend has no
  // such endpoint under /api/portal/*, so the button would always 404.
  const isCustomer = useAuthStore((s) => s.kind === 'portal');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <CreditCard className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Payments</h1>
              <p className="text-sm text-stone-500">Payments received from customers.</p>
            </div>
          </div>
          {!isCustomer && (
            <button
              onClick={() => navigate('/sales/payment/new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95"
            >
              <Plus className="size-3.5" />
              New Payment
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-4 flex-1 flex flex-col min-h-0">
          <PaymentTable />
        </div>
      </div>
    </div>
  );
}

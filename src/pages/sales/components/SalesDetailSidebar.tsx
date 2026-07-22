import { useState, type ReactNode } from 'react';
import { LayoutList, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  /** FAB label + sheet title on mobile, e.g. "Order Details". */
  label?: string;
};

// Sticky right-panel wrapper shared by every Sales document detail page
// (Sales Order, Quote, Estimate, Invoice, Payment, Refund, Credit Memo,
// Fabrication Job) — mirrors CrmDetailSidebar's mobile treatment: inline on
// lg+, a floating FAB + slide-up bottom sheet below lg, rather than the
// sidebar cards stacking below the main content and pushing a full extra
// screen's worth of scroll. Callers keep owning their own card content
// (Quick Actions/Status/Danger Zone etc. differ per document type) and just
// pass it as children.
export function SalesDetailSidebar({ children, label = 'Details' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:w-72 lg:shrink-0 lg:sticky lg:top-[4.5rem] lg:h-fit lg:self-start">
      {/* ── Desktop lg+: normal inline sidebar ── */}
      <div className="hidden lg:block">{children}</div>

      {/* ── Mobile: floating badge + slide-up bottom sheet ── */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${label.toLowerCase()}`}
          className="fixed bottom-6 right-4 z-30 flex items-center gap-1.5 rounded-full bg-stone-800 px-3.5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-stone-700 active:scale-95 transition-all"
        >
          <LayoutList className="size-3.5" />
          {label}
        </button>

        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className={cn(
            'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          )}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-stone-50 shadow-xl transition-transform duration-300 max-h-[82vh]',
            open ? 'translate-y-0' : 'translate-y-full',
          )}
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="h-1 w-10 rounded-full bg-stone-300" />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
            <h3 className="text-sm font-semibold text-stone-800">{label}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={`Close ${label.toLowerCase()}`}
              className="flex size-7 items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
            >
              <X className="size-4 text-stone-500" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 pt-4 pb-10 modal-scrollbar">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

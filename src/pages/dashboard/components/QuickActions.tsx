import { useNavigate } from 'react-router-dom';
import { Sparkles, ShoppingCart, ClipboardList, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  { id: 'lead', label: 'New Lead', path: '/crm/lead/new', icon: Sparkles, primary: true },
  { id: 'sales-order', label: 'New Sales Order', path: '/sales/sales_order/new', icon: ShoppingCart, primary: false },
  { id: 'requisition', label: 'New Requisition', path: '/purchases/requisition/new', icon: ClipboardList, primary: false },
  { id: 'purchase-order', label: 'New Purchase Order', path: '/purchases/purchase_order/new', icon: Package, primary: false },
] as const;

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-stone-300/70 bg-card p-6 ring-1 ring-foreground/5">
      <h2 className="font-brand text-lg text-foreground">Quick Actions</h2>
      <div className="mt-5 flex flex-col gap-2.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => navigate(action.path)}
              aria-label={action.label}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                action.primary
                  ? 'bg-brand text-stone-950 hover:bg-brand-hover'
                  : 'border border-stone-300 text-stone-700 hover:bg-stone-50 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/5',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

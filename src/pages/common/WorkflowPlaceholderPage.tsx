import * as React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  FileText,
  ShoppingCart,
  Receipt,
  CreditCard,
  FileMinus,
  RotateCcw,
  Building,
  ClipboardList,
  Package,
  Inbox,
  FileCheck,
  Banknote,
  FilePlus,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ModuleMeta {
  title: string;
  description: string;
  icon: LucideIcon;
}

const MODULE_META: Record<string, ModuleMeta> = {
  // Sales
  estimate: {
    title: 'Estimates',
    description: 'Create and manage price estimates for customers.',
    icon: FileSpreadsheet,
  },
  quote: {
    title: 'Quotes',
    description: 'Generate formal quotes for approved estimates.',
    icon: FileText,
  },
  sales_order: {
    title: 'Sales Orders',
    description: 'Track and fulfill confirmed customer orders.',
    icon: ShoppingCart,
  },
  invoice: {
    title: 'Invoices',
    description: 'Issue and track customer invoices.',
    icon: Receipt,
  },
  payment: {
    title: 'Payments',
    description: 'Record and reconcile customer payments.',
    icon: CreditCard,
  },
  credit_memo: {
    title: 'Credit Memos',
    description: 'Issue credit memos against customer invoices.',
    icon: FileMinus,
  },
  refund: {
    title: 'Refunds',
    description: 'Process and track customer refund requests.',
    icon: RotateCcw,
  },
  // Purchases
  vendor: {
    title: 'Vendors',
    description: 'Manage your vendor and supplier directory.',
    icon: Building,
  },
  requisition: {
    title: 'Requisitions',
    description: 'Create and approve internal purchase requests.',
    icon: ClipboardList,
  },
  purchase_order: {
    title: 'Purchase Orders',
    description: 'Send and track purchase orders with vendors.',
    icon: Package,
  },
  item_receipt: {
    title: 'Item Receipts',
    description: 'Log goods received against purchase orders.',
    icon: Inbox,
  },
  vendor_bill: {
    title: 'Vendor Bills',
    description: 'Record and approve vendor invoices.',
    icon: FileCheck,
  },
  vendor_payment: {
    title: 'Vendor Payments',
    description: 'Track and schedule payments to vendors.',
    icon: Banknote,
  },
  vendor_credit: {
    title: 'Vendor Credits',
    description: 'Manage credits received from vendors.',
    icon: FilePlus,
  },
  expense: {
    title: 'Expenses',
    description: 'Submit and approve employee expense claims.',
    icon: Wallet,
  },
};

export default function WorkflowPlaceholderPage(): React.JSX.Element {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const meta = MODULE_META[moduleKey ?? ''];

  if (!meta) return <Navigate to="/dashboard" replace />;

  const Icon = meta.icon;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
            <Icon className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                {meta.title}
              </h1>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-stone-500">{meta.description}</p>
          </div>
        </div>

        {/* Empty state */}
        <div className="mt-6 flex-1 flex items-center justify-center border-t border-stone-100 pt-6">
          <div className="text-center max-w-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-stone-100">
              <Icon className="size-9 text-stone-300" />
            </div>
            <h2 className="text-base font-semibold text-stone-700">
              Under Development
            </h2>
            <p className="mt-1.5 text-sm text-stone-400 leading-relaxed">
              The <span className="font-medium text-stone-600">{meta.title}</span> module is
              being built. Full functionality will be available soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Users,
  SlidersHorizontal,
  Workflow as WorkflowIcon,
  ShieldCheck,
  UserPlus,
  UsersRound,
  Hash,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  ShoppingCart,
  Wrench,
  Receipt,
  CreditCard,
  FileMinus,
  RotateCcw,
  Truck,
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

export interface NavPermission {
  resource: string;
  action: string;
}

export interface NavLink {
  type: 'link';
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: NavPermission;
  platformAdminOnly?: boolean;
}

export interface NavGroup {
  type: 'group';
  id: string;
  label: string;
  icon: LucideIcon;
  matchPaths: string[];
  children: NavLink[];
  permission?: NavPermission;
  platformAdminOnly?: boolean;
}

export type NavEntry = NavLink | NavGroup;

export interface NavSection {
  id: string;
  label: string;
  entries: NavEntry[];
  platformAdminOnly?: boolean;
}

export interface SidebarNavConfig {
  topItems: NavLink[];
  sections: NavSection[];
}

// Add new nav items here — no changes to Sidebar.tsx required.
// Each item declares its required permission; the sidebar hides items
// the signed-in user does not have a grant for.
export const sidebarNav: SidebarNavConfig = {
  topItems: [
    {
      type: 'link',
      id: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
  ],
  sections: [
    {
      id: 'workspace',
      label: 'Workspace',
      entries: [
        {
          type: 'group',
          id: 'crm',
          label: 'CRM',
          icon: Building2,
          matchPaths: ['/crm'],
          children: [
            {
              type: 'link',
              id: 'leads',
              label: 'Leads',
              path: '/crm/lead',
              icon: Sparkles,
              permission: { resource: 'lead', action: 'read' },
            },
            {
              type: 'link',
              id: 'prospects',
              label: 'Prospects',
              path: '/crm/prospect',
              icon: Users,
              permission: { resource: 'prospect', action: 'read' },
            },
            {
              type: 'link',
              id: 'customers',
              label: 'Customers',
              path: '/crm/customer',
              icon: Building2,
              permission: { resource: 'customer', action: 'read' },
            },
          ],
        },
        {
          type: 'group',
          id: 'sales',
          label: 'Sales',
          icon: TrendingUp,
          matchPaths: ['/sales'],
          children: [
            {
              type: 'link',
              id: 'estimates',
              label: 'Estimates',
              path: '/sales/estimate',
              icon: FileSpreadsheet,
            },
            {
              type: 'link',
              id: 'quotes',
              label: 'Quotes',
              path: '/sales/quote',
              icon: FileText,
            },
            {
              type: 'link',
              id: 'sales-orders',
              label: 'Sales Orders',
              path: '/sales/sales_order',
              icon: ShoppingCart,
            },
            {
              type: 'link',
              id: 'installation',
              label: 'Installation / Fabrication',
              path: '/sales/installation',
              icon: Wrench,
            },
            {
              type: 'link',
              id: 'invoices',
              label: 'Invoices',
              path: '/sales/invoice',
              icon: Receipt,
            },
            {
              type: 'link',
              id: 'payments',
              label: 'Payments',
              path: '/sales/payment',
              icon: CreditCard,
            },
            {
              type: 'link',
              id: 'credit-memos',
              label: 'Credit Memos',
              path: '/sales/credit_memo',
              icon: FileMinus,
            },
            {
              type: 'link',
              id: 'refunds',
              label: 'Refunds',
              path: '/sales/refund',
              icon: RotateCcw,
            },
          ],
        },
        {
          type: 'group',
          id: 'purchases',
          label: 'Purchases',
          icon: Truck,
          matchPaths: ['/purchases'],
          children: [
            {
              type: 'link',
              id: 'vendors',
              label: 'Vendors',
              path: '/purchases/vendor',
              icon: Building,
            },
            {
              type: 'link',
              id: 'requisitions',
              label: 'Requisitions',
              path: '/purchases/requisition',
              icon: ClipboardList,
            },
            {
              type: 'link',
              id: 'purchase-orders',
              label: 'Purchase Orders',
              path: '/purchases/purchase_order',
              icon: Package,
            },
            {
              type: 'link',
              id: 'item-receipts',
              label: 'Item Receipts',
              path: '/purchases/item_receipt',
              icon: Inbox,
            },
            {
              type: 'link',
              id: 'vendor-bills',
              label: 'Vendor Bills',
              path: '/purchases/vendor_bill',
              icon: FileCheck,
            },
            {
              type: 'link',
              id: 'vendor-payments',
              label: 'Vendor Payments',
              path: '/purchases/vendor_payment',
              icon: Banknote,
            },
            {
              type: 'link',
              id: 'vendor-credits',
              label: 'Vendor Credits',
              path: '/purchases/vendor_credit',
              icon: FilePlus,
            },
            {
              type: 'link',
              id: 'expenses',
              label: 'Expenses',
              path: '/purchases/expense',
              icon: Wallet,
            },
          ],
        },
      ],
    },
    {
      id: 'configure',
      label: 'Configure',
      entries: [
        {
          type: 'group',
          id: 'configuration',
          label: 'Configuration',
          icon: SlidersHorizontal,
          matchPaths: ['/config'],
          children: [
            {
              type: 'link',
              id: 'workflows',
              label: 'Workflows',
              path: '/config/workflows',
              icon: WorkflowIcon,
              permission: { resource: 'workflow', action: 'read' },
            },
            {
              type: 'link',
              id: 'roles-access',
              label: 'Roles & Access',
              path: '/config/roles',
              icon: ShieldCheck,
              permission: { resource: 'role', action: 'read' },
            },
            {
              type: 'link',
              id: 'users',
              label: 'Users',
              path: '/config/users',
              icon: UsersRound,
              permission: { resource: 'user', action: 'read' },
            },
            {
              type: 'link',
              id: 'record-numbering',
              label: 'Record Numbering',
              path: '/config/record-numbering',
              icon: Hash,
              permission: { resource: 'workflow_config', action: 'configure' },
            },
          ],
        },
      ],
    },
    {
      id: 'subscription',
      label: 'Subscription',
      entries: [
        {
          type: 'link',
          id: 'subscription',
          label: 'Plan & Billing',
          path: '/subscription',
          icon: CreditCard,
        },
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      platformAdminOnly: true,
      entries: [
        {
          type: 'link',
          id: 'onboarding',
          label: 'Onboarding',
          path: '/customer/onboarding',
          icon: UserPlus,
          platformAdminOnly: true,
        },
      ],
    },
  ],
};

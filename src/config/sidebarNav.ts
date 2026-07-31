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
  KeyRound,
  ScrollText,
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
  Landmark,
  ListTree,
  Settings2,
  Warehouse,
  MapPin,
  ClipboardEdit,
  Repeat,
  ClipboardCheck,
  Layers,
  Boxes,
  ArrowLeftRight,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavPermission {
  resource: string;
  action: string;
}

export interface NavLink {
  type: "link";
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Tailwind text-color classes applied to the icon only (light + dark). */
  iconColor: string;
  permission?: NavPermission;
  platformAdminOnly?: boolean;
}

export interface NavGroup {
  type: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind text-color classes applied to the icon only (light + dark). */
  iconColor: string;
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
//
// `iconColor` must be a literal Tailwind class string (never composed at
// runtime) so the Tailwind scanner keeps the utility in the build. Colors are
// grouped by domain: CRM = blue family, Sales = green/teal family,
// Purchases = amber/orange family, Inventory = purple/pink family,
// Configure = violet/slate family.
export const sidebarNav: SidebarNavConfig = {
  topItems: [
    {
      type: "link",
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      iconColor: "text-indigo-500 dark:text-indigo-400",
    },
  ],
  sections: [
    {
      id: "workspace",
      label: "Workspace",
      entries: [
        {
          type: "group",
          id: "crm",
          label: "CRM",
          icon: Building2,
          iconColor: "text-blue-600 dark:text-blue-400",
          matchPaths: ["/crm"],
          children: [
            {
              type: "link",
              id: "leads",
              label: "Leads",
              path: "/crm/lead",
              icon: Sparkles,
              iconColor: "text-amber-500 dark:text-amber-400",
              permission: { resource: "lead", action: "read" },
            },
            {
              type: "link",
              id: "prospects",
              label: "Prospects",
              path: "/crm/prospect",
              icon: Users,
              iconColor: "text-sky-500 dark:text-sky-400",
              permission: { resource: "prospect", action: "read" },
            },
            {
              type: "link",
              id: "customers",
              label: "Customers",
              path: "/crm/customer",
              icon: Building2,
              iconColor: "text-blue-600 dark:text-blue-400",
              permission: { resource: "customer", action: "read" },
            },
          ],
        },
        {
          type: "group",
          id: "sales",
          label: "Sales",
          icon: TrendingUp,
          iconColor: "text-emerald-600 dark:text-emerald-400",
          matchPaths: ["/sales"],
          children: [
            {
              type: "link",
              id: "estimates",
              label: "Estimates",
              path: "/sales/estimate",
              icon: FileSpreadsheet,
              iconColor: "text-teal-600 dark:text-teal-400",
            },
            {
              type: "link",
              id: "quotes",
              label: "Quotes",
              path: "/sales/quote",
              icon: FileText,
              iconColor: "text-cyan-600 dark:text-cyan-400",
            },
            {
              type: "link",
              id: "sales-orders",
              label: "Sales Orders",
              path: "/sales/sales_order",
              icon: ShoppingCart,
              iconColor: "text-emerald-600 dark:text-emerald-400",
            },
            {
              type: "link",
              id: "installation",
              label: "Installation / Fabrication",
              path: "/sales/installation",
              icon: Wrench,
              iconColor: "text-orange-500 dark:text-orange-400",
            },
            {
              type: "link",
              id: "invoices",
              label: "Invoices",
              path: "/sales/invoice",
              icon: Receipt,
              iconColor: "text-violet-500 dark:text-violet-400",
            },
            {
              type: "link",
              id: "payments",
              label: "Payments",
              path: "/sales/payment",
              icon: CreditCard,
              iconColor: "text-green-600 dark:text-green-400",
            },
            {
              type: "link",
              id: "credit-memos",
              label: "Credit Memos",
              path: "/sales/credit_memo",
              icon: FileMinus,
              iconColor: "text-rose-500 dark:text-rose-400",
            },
            {
              type: "link",
              id: "refunds",
              label: "Refunds",
              path: "/sales/refund",
              icon: RotateCcw,
              iconColor: "text-red-500 dark:text-red-400",
            },
          ],
        },
        {
          type: "group",
          id: "purchases",
          label: "Purchases",
          icon: Truck,
          iconColor: "text-amber-600 dark:text-amber-400",
          matchPaths: ["/purchases"],
          children: [
            {
              type: "link",
              id: "vendors",
              label: "Vendors",
              path: "/purchases/vendor",
              icon: Building,
              iconColor: "text-indigo-500 dark:text-indigo-400",
            },
            {
              type: "link",
              id: "requisitions",
              label: "Requisitions",
              path: "/purchases/requisition",
              icon: ClipboardList,
              iconColor: "text-amber-500 dark:text-amber-400",
            },
            {
              type: "link",
              id: "purchase-orders",
              label: "Purchase Orders",
              path: "/purchases/purchase_order",
              icon: Package,
              iconColor: "text-orange-500 dark:text-orange-400",
            },
            {
              type: "link",
              id: "item-receipts",
              label: "Item Receipts",
              path: "/purchases/item_receipt",
              icon: Inbox,
              iconColor: "text-lime-600 dark:text-lime-400",
              permission: { resource: "item_receipt", action: "read" },
            },
            {
              type: "link",
              id: "vendor-bills",
              label: "Vendor Bills",
              path: "/purchases/vendor_bill",
              icon: FileCheck,
              iconColor: "text-teal-600 dark:text-teal-400",
            },
            {
              type: "link",
              id: "vendor-payments",
              label: "Vendor Payments",
              path: "/purchases/vendor_payment",
              icon: Banknote,
              iconColor: "text-green-600 dark:text-green-400",
            },
            {
              type: "link",
              id: "vendor-credits",
              label: "Vendor Credits",
              path: "/purchases/vendor_credit",
              icon: FilePlus,
              iconColor: "text-rose-500 dark:text-rose-400",
            },
            {
              type: "link",
              id: "expenses",
              label: "Expenses",
              path: "/purchases/expense",
              icon: Wallet,
              iconColor: "text-fuchsia-500 dark:text-fuchsia-400",
            },
          ],
        },
        {
          type: "group",
          id: "inventory",
          label: "Inventory",
          icon: Warehouse,
          iconColor: "text-purple-600 dark:text-purple-400",
          matchPaths: ["/inventory"],
          children: [
            {
              type: "link",
              id: "inventory-items",
              label: "Items",
              path: "/inventory/item",
              icon: Package,
              iconColor: "text-violet-600 dark:text-violet-400",
              permission: { resource: "inventory_item", action: "read" },
            },
            {
              type: "link",
              id: "units-slabs",
              label: "Units / Slabs",
              path: "/inventory/unit",
              icon: Layers,
              iconColor: "text-fuchsia-500 dark:text-fuchsia-400",
              permission: { resource: "inventory_unit", action: "read" },
            },
            {
              type: "link",
              id: "bundles",
              label: "Bundles",
              path: "/inventory/bundle",
              icon: Boxes,
              iconColor: "text-amber-600 dark:text-amber-400",
              permission: { resource: "inventory_bundle", action: "read" },
            },
            {
              type: "link",
              id: "bin-management",
              label: "Bin Management",
              path: "/inventory/bin",
              icon: MapPin,
              iconColor: "text-purple-600 dark:text-purple-400",
              permission: { resource: "inventory_bin", action: "read" },
            },
            {
              type: "link",
              id: "warehouses",
              label: "Warehouses",
              path: "/inventory/warehouse",
              icon: Warehouse,
              iconColor: "text-teal-600 dark:text-teal-400",
              permission: { resource: "warehouse", action: "read" },
            },
            {
              type: "link",
              id: "adjust-inventory",
              label: "Adjust Inventory",
              path: "/inventory/adjustment",
              icon: ClipboardEdit,
              iconColor: "text-pink-500 dark:text-pink-400",
              permission: { resource: "inventory_adjustment", action: "read" },
            },
            {
              type: "link",
              id: "transfer-inventory",
              label: "Transfer Inventory",
              path: "/inventory/transfer",
              icon: Repeat,
              iconColor: "text-rose-500 dark:text-rose-400",
              permission: { resource: "inventory_transfer", action: "read" },
            },
            {
              type: "link",
              id: "inventory-count",
              label: "Inventory Count",
              path: "/inventory/count",
              icon: ClipboardCheck,
              iconColor: "text-indigo-500 dark:text-indigo-400",
              permission: { resource: "inventory_count", action: "read" },
            },
          ],
        },
        {
          type: "group",
          id: "finance",
          label: "Finance",
          icon: Landmark,
          iconColor: "text-cyan-700 dark:text-cyan-400",
          matchPaths: ["/finance"],
          children: [
            {
              type: "link",
              id: "journal-entries",
              label: "Journal Entries",
              path: "/finance/journal-entries",
              icon: ArrowLeftRight,
              iconColor: "text-sky-600 dark:text-sky-400",
              permission: { resource: "cash_transfer", action: "read" },
            },
            {
              type: "link",
              id: "chart-of-accounts",
              label: "Chart of Accounts",
              path: "/finance/chart-of-accounts",
              icon: ListTree,
              iconColor: "text-teal-600 dark:text-teal-400",
              permission: { resource: "chart_of_account", action: "read" },
            },
            {
              type: "link",
              id: "accounting-periods",
              label: "Accounting Periods",
              path: "/finance/accounting-periods",
              icon: CalendarClock,
              iconColor: "text-cyan-600 dark:text-cyan-400",
              permission: { resource: "accounting_period", action: "read" },
            },
            {
              type: "link",
              id: "account-defaults",
              label: "Default Accounts",
              path: "/finance/account-defaults",
              icon: Settings2,
              iconColor: "text-slate-500 dark:text-slate-400",
              permission: { resource: "chart_of_account", action: "configure" },
            },
          ],
        },
      ],
    },
    {
      id: "configure",
      label: "Configure",
      entries: [
        {
          type: "group",
          id: "configuration",
          label: "Configuration",
          icon: SlidersHorizontal,
          iconColor: "text-slate-500 dark:text-slate-400",
          matchPaths: ["/config"],
          children: [
            {
              type: "link",
              id: "workflows",
              label: "Workflows",
              path: "/config/workflows",
              icon: WorkflowIcon,
              iconColor: "text-violet-500 dark:text-violet-400",
              permission: { resource: "workflow", action: "read" },
            },
            {
              type: "link",
              id: "roles-access",
              label: "Roles & Access",
              path: "/config/roles",
              icon: ShieldCheck,
              iconColor: "text-emerald-600 dark:text-emerald-400",
              permission: { resource: "role", action: "read" },
            },
            {
              type: "link",
              id: "users",
              label: "Users",
              path: "/config/users",
              icon: UsersRound,
              iconColor: "text-sky-500 dark:text-sky-400",
              permission: { resource: "user", action: "read" },
            },
            {
              type: "link",
              id: "record-numbering",
              label: "Record Numbering",
              path: "/config/record-numbering",
              icon: Hash,
              iconColor: "text-amber-500 dark:text-amber-400",
              permission: { resource: "workflow_config", action: "configure" },
            },
            {
              type: "link",
              id: "inventory-setup",
              label: "Inventory Setup",
              path: "/config/inventory-setup",
              icon: Boxes,
              iconColor: "text-purple-500 dark:text-purple-400",
              permission: { resource: "inventory_lookup", action: "read" },
            },
            {
              type: "link",
              id: "authentication",
              label: "Authentication",
              path: "/config/authentication",
              icon: KeyRound,
              iconColor: "text-rose-500 dark:text-rose-400",
              permission: { resource: "sso_config", action: "read" },
            },
            {
              type: "link",
              id: "audit",
              label: "Audit Log",
              path: "/config/audit",
              icon: ScrollText,
              iconColor: "text-stone-500 dark:text-stone-400",
              permission: { resource: "audit", action: "read" },
            },
          ],
        },
      ],
    },
    {
      id: "account",
      label: "Account",
      entries: [
        {
          type: "link",
          id: "subscription",
          label: "Subscription",
          path: "/subscription",
          icon: CreditCard,
          iconColor: "text-purple-500 dark:text-purple-400",
        },
      ],
    },
    {
      id: "platform",
      label: "Platform",
      platformAdminOnly: true,
      entries: [
        {
          type: "link",
          id: "onboarding",
          label: "Onboarding",
          path: "/customer/onboarding",
          icon: UserPlus,
          iconColor: "text-pink-500 dark:text-pink-400",
          platformAdminOnly: true,
        },
      ],
    },
  ],
};

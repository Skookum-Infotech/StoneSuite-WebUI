import type { WidgetDefinition } from "@/types/dashboardWidgets";

// Catalog of every widget the dashboard can render. Governs what an admin
// can allocate to a user (src/pages/config/dashboard-widgets) and what a
// user can show/hide for themselves (the dashboard's Customize panel).
// Add new widgets here — DashboardPage's WIDGET_RENDERERS map (in
// src/pages/dashboard/DashboardPage.tsx) needs a matching entry by `id`.
export const WIDGET_CATALOG: WidgetDefinition[] = [
  {
    id: "kpi-strip",
    title: "KPI Strip",
    description: "Revenue, open leads, sales orders, and approvals at a glance.",
    category: "core",
    size: "full",
    defaultEnabled: true,
  },
  {
    id: "pipeline-donut",
    title: "Pipeline Breakdown",
    description: "Lead / Prospect / Customer mix and close rate.",
    category: "core",
    size: "half",
    defaultEnabled: true,
  },
  {
    id: "material-consumption",
    title: "Material Consumption",
    description: "Net area consumed per material, ranked highest first.",
    category: "core",
    size: "half",
    defaultEnabled: true,
  },
  {
    id: "recent-records",
    title: "Recent Records",
    description: "Latest activity across CRM, Sales & Purchases.",
    category: "core",
    size: "full",
    defaultEnabled: true,
  },
  {
    id: "sales-orders-snapshot",
    title: "Sales Orders Snapshot",
    description: "Open order count, open value, and overdue orders.",
    category: "sales",
    size: "half",
    defaultEnabled: false,
  },
  {
    id: "top-customers",
    title: "Top Customers by Value",
    description: "Ranked leaderboard of the highest-value customers.",
    category: "sales",
    size: "third",
    defaultEnabled: false,
  },
  {
    id: "inventory-alerts",
    title: "Inventory / Low-Stock Alerts",
    description: "Items below their reorder threshold, by warehouse.",
    category: "operations",
    size: "half",
    defaultEnabled: false,
  },
  {
    id: "purchases-status",
    title: "Purchases & Requisitions Status",
    description: "Pending approvals, incoming POs, and overdue receipts.",
    category: "operations",
    size: "half",
    defaultEnabled: false,
  },
  {
    id: "ar-outstanding",
    title: "Accounts Receivable / Outstanding Invoices",
    description: "Total outstanding balance with an aging breakdown.",
    category: "finance",
    size: "half",
    defaultEnabled: false,
  },
  {
    id: "accounting-snapshot",
    title: "Accounting Snapshot",
    description: "Current period status and recent journal entries.",
    category: "finance",
    size: "third",
    defaultEnabled: false,
  },
];

export const WIDGET_CATEGORY_ORDER: WidgetDefinition["category"][] = [
  "core",
  "sales",
  "operations",
  "finance",
];

export const WIDGET_CATEGORY_LABELS: Record<WidgetDefinition["category"], string> = {
  core: "Core",
  sales: "Sales",
  operations: "Operations",
  finance: "Finance",
};

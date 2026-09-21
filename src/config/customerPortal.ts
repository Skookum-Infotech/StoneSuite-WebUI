import { SUPPORT_PATH } from '@/lib/feedback';

// Paths a customer-portal session may reach under MainLayout — its four
// document types (List and Detail; Add/Edit already render "Access Denied" via
// PermissionGuard), its own account settings, and Support. MainLayout redirects
// everything else to Sales Orders.
//
// An explicit allowlist at one choke point, rather than relying on every route
// remembering its own PermissionGuard: /dashboard, /transactions and
// /subscription, for instance, declare none at all. A sidebar link shown to
// customers (`customerVisible`) must point inside this list — sidebarNav.test.ts
// enforces that.
export const CUSTOMER_ALLOWED_PATH_PREFIXES: readonly string[] = [
  '/sales/sales_order',
  '/sales/invoice',
  '/sales/payment',
  '/sales/refund',
  '/account/settings',
  SUPPORT_PATH,
];

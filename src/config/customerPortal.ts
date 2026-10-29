import { SUPPORT_PATH } from '@/lib/feedback';
import { CREATED_ORDERS_PATH } from '@/lib/createdOrderRoutes';

// Paths a customer-portal session may reach under MainLayout — its four
// document types (List and Detail; Add/Edit already render "Access Denied" via
// PermissionGuard), the Created Orders list and form it files itself, its own
// account settings, and Support. MainLayout redirects everything else to Sales
// Orders.
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
  CREATED_ORDERS_PATH,
  '/account/settings',
  '/customer/fabrication-approvals',
  SUPPORT_PATH,
];

/** Whether a customer-portal session may open `pathname`. The one test both
 *  MainLayout's redirect and the sidebar apply, so a link is never offered to a
 *  customer that the layout would bounce them away from — a staff-only page that
 *  reuses a resource the portal is granted (the Activity Planner reads under
 *  `sales_order:read`) must not show up in their menu. */
export function isCustomerAllowedPath(pathname: string): boolean {
  return CUSTOMER_ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

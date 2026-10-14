import { describe, it, expect } from 'vitest';
import { sidebarNav } from './sidebarNav';
import { CUSTOMER_ALLOWED_PATH_PREFIXES, isCustomerAllowedPath } from './customerPortal';
import { CREATED_ORDERS_PATH, NEW_CREATED_ORDER_PATH } from '@/lib/createdOrderRoutes';
import { SUPPORT_PATH } from '@/lib/feedback';
import type { NavEntry, NavLink } from './sidebarNav';

/** Every leaf link in the tree, with a readable trail for failure messages. */
function allLinks(): { link: NavLink; trail: string }[] {
  const out: { link: NavLink; trail: string }[] = [];
  const visit = (entry: NavEntry, trail: string) => {
    if (entry.type === 'link') {
      out.push({ link: entry, trail: `${trail} > ${entry.label}` });
      return;
    }
    for (const child of entry.children) visit(child, `${trail} > ${entry.label}`);
  };
  for (const item of sidebarNav.topItems) visit(item, 'topItems');
  for (const section of sidebarNav.sections) {
    for (const entry of section.entries) visit(entry, section.label);
  }
  return out;
}

describe('sidebarNav access declarations', () => {
  // The guard that matters. Sidebar.canShowLink fails closed on an undeclared
  // permission, so a link missing one silently disappears instead of silently
  // over-exposing — but either way it is a bug, and this catches it at the
  // config layer where the fix belongs.
  it('every link declares a permission, alwaysVisible, or platformAdminOnly', () => {
    const undeclared = allLinks()
      .filter(({ link }) => !link.permission && !link.alwaysVisible && !link.platformAdminOnly)
      .map(({ trail }) => trail);

    expect(undeclared, `Links with no access declaration:\n  ${undeclared.join('\n  ')}`).toEqual([]);
  });

  it('declared permissions use snake_case resources and known actions', () => {
    const actions = ['create', 'read', 'update', 'delete', 'transition', 'approve', 'configure'];
    for (const { link, trail } of allLinks()) {
      if (!link.permission) continue;
      expect(link.permission.resource, `${trail} resource`).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(actions, `${trail} action`).toContain(link.permission.action);
    }
  });

  it('does not mark a link both alwaysVisible and permission-gated', () => {
    const both = allLinks()
      .filter(({ link }) => link.alwaysVisible && link.permission)
      .map(({ trail }) => trail);

    expect(both, `Contradictory declarations:\n  ${both.join('\n  ')}`).toEqual([]);
  });

  // `customerVisible` opts an ungated link into customer-portal sessions. A
  // permission-gated link reaches a customer only through PORTAL_GRANTS, so the
  // flag next to a `permission` (or without alwaysVisible) would be dead config
  // that reads as if it works.
  it('customerVisible is only set on ungated alwaysVisible links', () => {
    const misuse = allLinks()
      .filter(({ link }) => link.customerVisible && (!link.alwaysVisible || link.permission))
      .map(({ trail }) => trail);

    expect(misuse, `customerVisible without alwaysVisible, or beside a permission:\n  ${misuse.join('\n  ')}`).toEqual([]);
  });

  // MainLayout redirects a customer session away from any path outside its
  // allowlist, so a link shown to customers must land inside it — otherwise
  // clicking it silently bounces them to Sales Orders.
  it('every customerVisible link points at a path customers may reach', () => {
    const unreachable = allLinks()
      .filter(({ link }) => link.customerVisible)
      .filter(({ link }) => !CUSTOMER_ALLOWED_PATH_PREFIXES.some((prefix) => link.path.startsWith(prefix)))
      .map(({ trail }) => trail);

    expect(unreachable, `customerVisible links outside the customer allowlist:\n  ${unreachable.join('\n  ')}`).toEqual([]);
  });

  // The nav literal, the router entry and the Help menu shortcut all name the
  // Support page; this catches the nav copy drifting from the shared constant.
  it('My Tickets points at the Support page route', () => {
    const entry = allLinks().find(({ link }) => link.id === 'my-tickets');

    expect(entry?.link.path).toBe(SUPPORT_PATH);
  });

  it('ids are unique so React keys and open-state tracking stay stable', () => {
    const ids = allLinks().map(({ link }) => link.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  // workflowKey and permission.resource are declared separately but are
  // expected to name the same workflow — this catches the two drifting apart
  // (e.g. a resource rename that forgets its sibling workflowKey).
  it('a declared workflowKey matches the link\'s permission resource', () => {
    for (const { link, trail } of allLinks()) {
      if (!link.workflowKey) continue;
      expect(link.permission?.resource, `${trail} workflowKey vs resource`).toBe(link.workflowKey);
    }
  });

  // buildPermModules keeps the first link to name a resource, so the Calendar
  // group has to come after Sales or the role editor would list Sales Orders
  // under Calendar.
  it('puts the Calendar group after Sales', () => {
    const entries = sidebarNav.sections.flatMap((s) => s.entries).filter((e) => e.type === 'group');
    const ids = entries.map((e) => e.id);

    expect(ids).toContain('calendar');
    expect(ids.indexOf('calendar')).toBeGreaterThan(ids.indexOf('sales'));
  });

  it('points the Activity Planner at its route', () => {
    const entry = allLinks().find(({ link }) => link.id === 'activity-planner');

    expect(entry?.link.path).toBe('/calendar/activity-planner');
    expect(entry?.link.permission).toEqual({ resource: 'sales_order', action: 'read' });
  });

  it('CRM and Sales links declare the workflow that backs their form', () => {
    const expected: Record<string, string> = {
      leads: 'lead',
      prospects: 'prospect',
      customers: 'customer',
      estimates: 'estimate',
      quotes: 'quote',
      'sales-orders': 'sales_order',
      installation: 'installation',
      'activity-planner': 'sales_order',
      invoices: 'invoice',
      payments: 'payment',
      'credit-memos': 'credit_memo',
      refunds: 'refund',
      vendors: 'vendor',
      requisitions: 'requisition',
      'purchase-orders': 'purchase_order',
      'item-receipts': 'item_receipt',
      'vendor-bills': 'vendor_bill',
      'vendor-payments': 'vendor_payment',
      'vendor-credits': 'vendor_credit',
      expenses: 'expense',
    };
    const byId = new Map(allLinks().map(({ link }) => [link.id, link]));
    for (const [id, workflowKey] of Object.entries(expected)) {
      expect(byId.get(id)?.workflowKey, `${id} workflowKey`).toBe(workflowKey);
    }
  });
});

describe('portal-only links', () => {
  it('customerOnly links are also alwaysVisible and customerVisible', () => {
    const misuse = allLinks()
      .filter(({ link }) => link.customerOnly && !(link.alwaysVisible && link.customerVisible))
      .map(({ trail }) => trail);

    expect(misuse, `customerOnly without alwaysVisible + customerVisible:\n  ${misuse.join('\n  ')}`).toEqual([]);
  });

  it('Created Orders points at the shared route and is portal-only', () => {
    const entry = allLinks().find(({ link }) => link.id === 'created-orders');

    expect(entry?.link.path).toBe(CREATED_ORDERS_PATH);
    expect(entry?.link.customerOnly).toBe(true);
    expect(entry?.link.permission).toBeUndefined();
  });

  it('lets a customer session reach the Created Orders pages', () => {
    expect(isCustomerAllowedPath(CREATED_ORDERS_PATH)).toBe(true);
    expect(isCustomerAllowedPath(NEW_CREATED_ORDER_PATH)).toBe(true);
  });
});

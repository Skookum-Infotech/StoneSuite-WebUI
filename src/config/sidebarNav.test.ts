import { describe, it, expect } from 'vitest';
import { sidebarNav } from './sidebarNav';
import { CUSTOMER_ALLOWED_PATH_PREFIXES } from './customerPortal';
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

  it('CRM and Sales links declare the workflow that backs their form', () => {
    const expected: Record<string, string> = {
      leads: 'lead',
      prospects: 'prospect',
      customers: 'customer',
      estimates: 'estimate',
      quotes: 'quote',
      'sales-orders': 'sales_order',
      installation: 'installation',
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

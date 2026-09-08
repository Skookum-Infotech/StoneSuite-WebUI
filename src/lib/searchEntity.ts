import { recordRoute } from '@/lib/recentRecordRoute';
import { formatBreadcrumbSegment } from '@/lib/breadcrumb';
import type { SearchHit } from '@/types/search';

// Plural, human display label per entity type — used for dropdown group headers,
// result-page tabs, and badges. Anything not listed falls back to a title-cased
// version of the type key.
const TYPE_LABELS: Record<string, string> = {
  customer: 'Customers',
  lead: 'Leads',
  prospect: 'Prospects',
  crm_activity: 'Activity',
  customer_note: 'Customer Notes',
  quote: 'Quotes',
  estimate: 'Estimates',
  sales_order: 'Sales Orders',
  invoice: 'Invoices',
  payment: 'Payments',
  credit_memo: 'Credit Memos',
  refund: 'Refunds',
  fabrication_job: 'Fabrication Jobs',
  vendor: 'Vendors',
  requisition: 'Requisitions',
  purchase_order: 'Purchase Orders',
  item_receipt: 'Item Receipts',
  vendor_bill: 'Vendor Bills',
  vendor_payment: 'Vendor Payments',
  vendor_credit: 'Vendor Credits',
  expense: 'Expenses',
  inventory_item: 'Inventory Items',
  inventory_unit: 'Slabs',
  inventory_adjustment: 'Inventory Adjustments',
  inventory_transfer: 'Inventory Transfers',
  inventory_count: 'Inventory Counts',
  chart_of_account: 'Accounts',
  cash_transfer: 'Journal Entries',
  user: 'Team Members',
};

// Stable display order for groups/tabs — clients first, then sales, purchasing,
// inventory, finance, admin. Types not listed sort last, alphabetically.
const TYPE_ORDER = [
  'customer', 'lead', 'prospect', 'crm_activity', 'customer_note',
  'quote', 'estimate', 'sales_order', 'invoice', 'payment', 'credit_memo', 'refund', 'fabrication_job',
  'vendor', 'requisition', 'purchase_order', 'item_receipt', 'vendor_bill', 'vendor_payment', 'vendor_credit', 'expense',
  'inventory_item', 'inventory_unit', 'inventory_adjustment', 'inventory_transfer', 'inventory_count',
  'chart_of_account', 'cash_transfer',
  'user',
];

export function entityLabel(type: string): string {
  return TYPE_LABELS[type] ?? formatBreadcrumbSegment(type);
}

export function compareEntityTypes(a: string, b: string): number {
  const ia = TYPE_ORDER.indexOf(a);
  const ib = TYPE_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

// Entity types with no per-record detail route — their hits deep-link a list
// page. (crm_activity / customer_note are NOT here: the backend already routes
// those to the parent customer's detail page.)
const LIST_ONLY: Record<string, string> = {
  user: '/config/users',
};

export function hasDetailRoute(type: string): boolean {
  return !(type in LIST_ONLY);
}

// Where clicking a hit navigates.
export function hitRoute(hit: SearchHit): string {
  return LIST_ONLY[hit.type] ?? recordRoute(hit.domain, hit.module, hit.id);
}

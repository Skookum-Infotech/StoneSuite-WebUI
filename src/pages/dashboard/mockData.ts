export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaTone: 'up' | 'warn' | 'neutral';
  sparkline: number[];
  sparklineColor: string;
}

// Placeholder figures for a stone-fabrication CRM's operations console —
// replace with a real dashboard-summary service call once that endpoint exists.
export const kpiMetrics: KpiMetric[] = [
  {
    id: 'revenue',
    label: 'Revenue',
    value: '$184,250',
    delta: '▲ 18%',
    deltaTone: 'up',
    sparkline: [58, 64, 60, 74, 70, 86, 92],
    sparklineColor: '#719c3b',
  },
  {
    id: 'leads',
    label: 'Open Leads',
    value: '24',
    delta: '▲ 6 this week',
    deltaTone: 'up',
    sparkline: [59, 62, 58, 72, 71, 82, 88],
    sparklineColor: '#a855f7',
  },
  {
    id: 'sales-orders',
    label: 'Sales Orders',
    value: '12',
    delta: '4 in fabrication',
    deltaTone: 'neutral',
    sparkline: [70, 72, 66, 76, 71, 78, 74],
    sparklineColor: '#059669',
  },
  {
    id: 'requisitions',
    label: 'Needs Approval',
    value: '5',
    delta: 'oldest 2 days',
    deltaTone: 'warn',
    sparkline: [78, 72, 76, 64, 70, 58, 62],
    sparklineColor: '#d97706',
  },
];

// Pipeline mix now runs on real data — see dashboardDataService.getPipelineMix
// and src/types/dashboardData.ts (PipelineMix/PipelineMixSegment).

export interface MaterialUsage {
  id: string;
  name: string;
  slabsCut: number;
  swatch: string;
}

export const materialUsage: MaterialUsage[] = [
  { id: '1', name: 'Carrara Marble', slabsCut: 42, swatch: 'linear-gradient(125deg,#e9e9e7,#d3d3cf 55%,#e9e9e7)' },
  { id: '2', name: 'Calacatta Gold', slabsCut: 31, swatch: 'linear-gradient(120deg,#efeae1,#e0d8ca 60%,#efeae1)' },
  { id: '3', name: 'Black Galaxy', slabsCut: 23, swatch: 'radial-gradient(circle at 30% 30%,#423f3a,#17140f 70%)' },
  { id: '4', name: 'Crema Marfil', slabsCut: 17, swatch: 'linear-gradient(130deg,#d9cfc0,#bda98d 60%,#d9cfc0)' },
  { id: '5', name: 'Verde Alpi', slabsCut: 11, swatch: 'linear-gradient(115deg,#4a5b52,#26332c 60%,#3d4c44)' },
];

export interface RecentRecord {
  id: string;
  type: string;
  typeBg: string;
  typeText: string;
  recordNumber: string;
  account: string;
  value: number | null;
  status: string;
  statusColor: string;
  updatedAt: string;
}

export const recentRecords: RecentRecord[] = [
  {
    id: '1', type: 'Lead', typeBg: 'bg-workflow-lead-bg', typeText: 'text-workflow-lead-text',
    recordNumber: 'LEAD-1084', account: 'Whitmore Residence', value: null,
    status: 'New', statusColor: '#a855f7', updatedAt: '12m ago',
  },
  {
    id: '2', type: 'Sales Order', typeBg: 'bg-emerald-100', typeText: 'text-emerald-700',
    recordNumber: 'SO-1042', account: 'Fontaine Builders', value: 28400,
    status: 'Fabrication', statusColor: '#d97706', updatedAt: '48m ago',
  },
  {
    id: '3', type: 'Vendor Bill', typeBg: 'bg-teal-100', typeText: 'text-teal-700',
    recordNumber: 'VB-2091', account: 'Apex Stone Supply', value: 9120,
    status: 'Approved', statusColor: '#059669', updatedAt: '2h ago',
  },
  {
    id: '4', type: 'Requisition', typeBg: 'bg-amber-100', typeText: 'text-amber-700',
    recordNumber: 'REQ-118', account: 'Warehouse 1', value: 4780,
    status: 'Pending', statusColor: '#d97706', updatedAt: '5h ago',
  },
  {
    id: '5', type: 'Prospect', typeBg: 'bg-workflow-prospect-bg', typeText: 'text-workflow-prospect-text',
    recordNumber: 'PRO-0417', account: 'Marsh Countertop Co.', value: 16900,
    status: 'Quoted', statusColor: '#3b82f6', updatedAt: '1d ago',
  },
];

// ----- Additional widgets (allocated/enabled per user via Config > Dashboard Widgets) -----

export interface OpenSalesOrder {
  id: string;
  orderNumber: string;
  customer: string;
  value: number;
  status: string;
  isOverdue: boolean;
}

export const openSalesOrders: OpenSalesOrder[] = [
  { id: '1', orderNumber: 'SO-1042', customer: 'Fontaine Builders', value: 28400, status: 'Fabrication', isOverdue: false },
  { id: '2', orderNumber: 'SO-1039', customer: 'Sterling Kitchen & Bath', value: 15200, status: 'Install Scheduled', isOverdue: false },
  { id: '3', orderNumber: 'SO-1031', customer: 'Marsh Countertop Co.', value: 9800, status: 'Fabrication', isOverdue: true },
  { id: '4', orderNumber: 'SO-1027', customer: 'Whitmore Residence', value: 21750, status: 'Awaiting Deposit', isOverdue: true },
  { id: '5', orderNumber: 'SO-1024', customer: 'Meridian Countertops', value: 12300, status: 'Fabrication', isOverdue: false },
  { id: '6', orderNumber: 'SO-1019', customer: 'Bellwood Design Group', value: 33500, status: 'Install Scheduled', isOverdue: false },
];

export interface CustomerValue {
  id: string;
  name: string;
  value: number;
}

export const customerValues: CustomerValue[] = [
  { id: '1', name: 'Bellwood Design Group', value: 142300 },
  { id: '2', name: 'Fontaine Builders', value: 118900 },
  { id: '3', name: 'Sterling Kitchen & Bath', value: 96500 },
  { id: '4', name: 'Meridian Countertops', value: 74200 },
  { id: '5', name: 'Marsh Countertop Co.', value: 61800 },
  { id: '6', name: 'Whitmore Residence', value: 44100 },
];

export interface InventoryAlert {
  id: string;
  itemName: string;
  warehouse: string;
  quantityOnHand: number;
  reorderThreshold: number;
  severity: 'critical' | 'low';
}

export const inventoryAlerts: InventoryAlert[] = [
  { id: '1', itemName: 'Carrara Marble Slab', warehouse: 'Warehouse 1', quantityOnHand: 2, reorderThreshold: 10, severity: 'critical' },
  { id: '2', itemName: 'Edge Polish Adhesive', warehouse: 'Warehouse 2', quantityOnHand: 6, reorderThreshold: 12, severity: 'low' },
  { id: '3', itemName: 'Black Galaxy Slab', warehouse: 'Warehouse 1', quantityOnHand: 3, reorderThreshold: 8, severity: 'critical' },
  { id: '4', itemName: 'Sink Cutout Templates', warehouse: 'Warehouse 2', quantityOnHand: 9, reorderThreshold: 15, severity: 'low' },
];

export interface PurchaseStatusItem {
  id: string;
  recordNumber: string;
  vendor: string;
  amount: number;
  status: 'pending_approval' | 'incoming' | 'overdue_receipt';
  detail: string;
}

export const purchaseStatusItems: PurchaseStatusItem[] = [
  { id: '1', recordNumber: 'REQ-118', vendor: 'Apex Stone Supply', amount: 4780, status: 'pending_approval', detail: 'oldest 2 days' },
  { id: '2', recordNumber: 'REQ-121', vendor: 'Coastal Fabrication Tools', amount: 1250, status: 'pending_approval', detail: 'oldest 4 hours' },
  { id: '3', recordNumber: 'PO-2087', vendor: 'Apex Stone Supply', amount: 18400, status: 'incoming', detail: 'due Thursday' },
  { id: '4', recordNumber: 'PO-2091', vendor: 'Granite Direct Wholesale', amount: 9600, status: 'incoming', detail: 'due next week' },
  { id: '5', recordNumber: 'ITR-330', vendor: 'Apex Stone Supply', amount: 6200, status: 'overdue_receipt', detail: '3 days overdue' },
];

export interface JournalEntrySummary {
  id: string;
  entryNumber: string;
  description: string;
  amount: number;
  date: string;
}

export const recentJournalEntries: JournalEntrySummary[] = [
  { id: '1', entryNumber: 'JE-0231', description: 'Fabrication labor accrual', amount: 4200, date: '2h ago' },
  { id: '2', entryNumber: 'JE-0230', description: 'Slab inventory adjustment', amount: 1180, date: '5h ago' },
  { id: '3', entryNumber: 'JE-0229', description: 'Vendor payment — Apex Stone Supply', amount: 9120, date: '1d ago' },
];

export interface AccountingPeriodSummary {
  name: string;
  status: 'open' | 'closed';
  entryCount: number;
}

export const currentAccountingPeriod: AccountingPeriodSummary = {
  name: 'August 2026',
  status: 'open',
  entryCount: 47,
};

export interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  amount: number;
  daysPastDue: number;
}

export const outstandingInvoices: OutstandingInvoice[] = [
  { id: '1', invoiceNumber: 'INV-3301', customer: 'Fontaine Builders', amount: 8400, daysPastDue: 0 },
  { id: '2', invoiceNumber: 'INV-3288', customer: 'Marsh Countertop Co.', amount: 5200, daysPastDue: 18 },
  { id: '3', invoiceNumber: 'INV-3260', customer: 'Whitmore Residence', amount: 12900, daysPastDue: 42 },
  { id: '4', invoiceNumber: 'INV-3211', customer: 'Sterling Kitchen & Bath', amount: 3100, daysPastDue: 67 },
  { id: '5', invoiceNumber: 'INV-3155', customer: 'Meridian Countertops', amount: 7600, daysPastDue: 98 },
];

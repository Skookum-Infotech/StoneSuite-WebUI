// KPI strip now runs on real data — see dashboardDataService.getKpiStrip and
// src/types/dashboardData.ts (KpiMetric/KpiStripData).

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

// Recent records now runs on real data — see dashboardDataService.getRecentRecords
// and src/types/dashboardData.ts (RecentRecord/RecentRecordsData).

// Sales orders snapshot now runs on real data — see
// dashboardDataService.getSalesOrdersSnapshot and src/types/dashboardData.ts
// (SalesOrdersSnapshotData/SalesOrderStatusBucket/SalesOrderAtRisk).

// Top customers now runs on real data — see dashboardDataService.getTopCustomers
// and src/types/dashboardData.ts (TopCustomer/TopCustomersData).

// Inventory alerts now runs on real data — see dashboardDataService.getInventoryAlerts
// and src/types/dashboardData.ts (InventoryStockAlert/InventoryAlertsData).

// ----- Additional widgets (allocated/enabled per user via Config > Dashboard Widgets) -----

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

// KPI strip now runs on real data — see dashboardDataService.getKpiStrip and
// src/types/dashboardData.ts (KpiMetric/KpiStripData).

// Pipeline mix now runs on real data — see dashboardDataService.getPipelineMix
// and src/types/dashboardData.ts (PipelineMix/PipelineMixSegment).

// Material consumption now runs on real data — see
// dashboardDataService.getMaterialConsumption and src/types/dashboardData.ts
// (MaterialConsumptionRow/MaterialConsumptionData).

// Recent records now runs on real data — see dashboardDataService.getRecentRecords
// and src/types/dashboardData.ts (RecentRecord/RecentRecordsData).

// Sales orders snapshot now runs on real data — see
// dashboardDataService.getSalesOrdersSnapshot and src/types/dashboardData.ts
// (SalesOrdersSnapshotData/SalesOrderStatusBucket/SalesOrderAtRisk).

// Top customers now runs on real data — see dashboardDataService.getTopCustomers
// and src/types/dashboardData.ts (TopCustomer/TopCustomersData).

// Inventory alerts now runs on real data — see dashboardDataService.getInventoryAlerts
// and src/types/dashboardData.ts (InventoryStockAlert/InventoryAlertsData).

// Purchases & requisitions status now runs on real data -- see
// dashboardDataService.getPurchasesStatus and src/types/dashboardData.ts
// (PurchasesStatusData/PurchasesTileValue/PurchasesAttentionRow).

// ----- Additional widgets (allocated/enabled per user via Config > Dashboard Widgets) -----

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
  { id: '4', entryNumber: 'JE-0228', description: 'Sales tax accrual', amount: 2640, date: '1d ago' },
  { id: '5', entryNumber: 'JE-0227', description: 'Equipment depreciation', amount: 1750, date: '2d ago' },
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

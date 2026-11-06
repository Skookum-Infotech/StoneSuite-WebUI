import type { ReportModuleInfo } from '@/types/reports';

/** Every Reports sub-module and the reports on its hub page. A report with a
 *  `path` is built; one without shows as "Coming soon". Adding a report means
 *  adding it here and giving it a route — the hub and sidebar need nothing else. */
export const REPORT_MODULES: ReportModuleInfo[] = [
  {
    slug: 'crm',
    label: 'CRM',
    description: 'How leads become customers, and where they stall.',
    resource: 'report_crm',
    reports: [
      { id: 'conversion-funnel', title: 'Conversion Funnel', description: 'Leads to prospects to customers, with the percentage that move on at each step.', path: '/reports/crm/funnel' },
      { id: 'lead-source', title: 'Lead Source Performance', description: 'Which sources produce leads that qualify, convert and bring in revenue.', path: '/reports/crm/lead-sources' },
      { id: 'stale-leads', title: 'Stale Leads & Prospects', description: 'Open records with no activity for a set number of days.', path: '/reports/crm/stale' },
    ],
  },
  {
    slug: 'sales',
    label: 'Sales',
    description: 'What you sold, to whom, and how profitable it was.',
    resource: 'report_sales',
    reports: [
      { id: 'by-customer', title: 'Sales by Customer', description: 'Revenue, margin, order count and last order per customer.', path: '/reports/sales/by-customer' },
      { id: 'by-item', title: 'Sales by Item', description: 'Quantity, revenue, average price and margin per item.', path: '/reports/sales/by-item' },
      { id: 'trend', title: 'Sales Trend', description: 'Revenue and margin by week or month over the period.', path: '/reports/sales/trend' },
    ],
  },
  {
    slug: 'purchases',
    label: 'Purchases',
    description: 'What you buy, from whom, and what you still owe.',
    resource: 'report_purchases',
    reports: [
      { id: 'by-vendor', title: 'Purchases by Vendor', description: 'Billed amount, PO count and open PO value per vendor.', path: '/reports/purchases/by-vendor' },
      { id: 'by-item', title: 'Purchases by Item', description: 'Quantity bought and average, lowest and highest unit cost per item.', path: '/reports/purchases/by-item' },
      { id: 'open-pos', title: 'Open POs & Receiving', description: 'Purchase orders not fully received, and how late they are.', path: '/reports/purchases/open-pos' },
      { id: 'ap-aging', title: 'AP Aging', description: 'Unpaid vendor bills by vendor in 0-30, 31-60, 61-90 and 90+ day buckets.', path: '/reports/purchases/ap-aging' },
    ],
  },
  {
    slug: 'inventory',
    label: 'Inventory',
    description: 'What is in stock, what it is worth, and what is running low.',
    resource: 'report_inventory',
    reports: [
      { id: 'stock-valuation', title: 'Stock on Hand & Valuation', description: 'Quantity on hand and value per item, location and bin.' },
      { id: 'slab-availability', title: 'Slab Availability', description: 'Available, reserved and on-order slabs by material.' },
      { id: 'low-stock', title: 'Low Stock', description: 'Items at or below their reorder point, with what is already on order.' },
      { id: 'stock-movement', title: 'Stock Movement', description: 'Receipts, consumption, adjustments and transfers per item.' },
    ],
  },
  {
    slug: 'calendar',
    label: 'Calendar',
    description: 'Installs and scheduled activities: what is coming and what is late.',
    resource: 'report_calendar',
    reports: [
      { id: 'upcoming-installs', title: 'Upcoming Installs', description: 'Installs by week for the weeks ahead.' },
      { id: 'overdue-activities', title: 'Overdue Activities', description: 'Scheduled activities past their planned date and not completed.' },
      { id: 'on-time', title: 'On-time Completion', description: 'Share of activities completed on or before their planned date.' },
      { id: 'lead-time', title: 'Order-to-Install Lead Time', description: 'Average days from order to install, by month.' },
    ],
  },
  {
    slug: 'finance',
    label: 'Finance',
    description: 'Profit and loss from your posted journal entries.',
    resource: 'report_finance',
    reports: [
      { id: 'profit-loss', title: 'Profit & Loss', description: 'Income minus expenses by account for the period.' },
    ],
  },
];

export function findReportModule(slug: string | undefined): ReportModuleInfo | undefined {
  return REPORT_MODULES.find((m) => m.slug === slug);
}

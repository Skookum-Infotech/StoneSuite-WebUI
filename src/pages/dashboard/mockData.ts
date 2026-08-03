import {
  Sparkles,
  Users,
  ShoppingCart,
  ClipboardList,
  AlertTriangle,
  Wrench,
  FileCheck,
  ClipboardCheck,
  Banknote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StatCardData {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  hero?: boolean;
}

// Placeholder figures for a stone-fabrication CRM's daily snapshot — replace
// with a real dashboard-summary service call once that endpoint exists.
export const dashboardStats: StatCardData[] = [
  {
    id: 'revenue',
    label: 'Revenue this month',
    value: '$184,250',
    delta: '+18% vs last month',
    trend: 'up',
    icon: Banknote,
    iconColor: 'text-brand-dark',
    iconBg: 'bg-brand/20',
    hero: true,
  },
  {
    id: 'leads',
    label: 'Open Leads',
    value: '24',
    delta: '+6 this week',
    trend: 'up',
    icon: Sparkles,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-500/10',
  },
  {
    id: 'prospects',
    label: 'Active Prospects',
    value: '17',
    delta: '+3 this week',
    trend: 'up',
    icon: Users,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-100 dark:bg-sky-500/10',
  },
  {
    id: 'sales-orders',
    label: 'Sales Orders in Progress',
    value: '12',
    delta: '4 in fabrication',
    trend: 'flat',
    icon: ShoppingCart,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-500/10',
  },
  {
    id: 'requisitions',
    label: 'Requisitions Pending',
    value: '5',
    delta: 'awaiting approval',
    trend: 'flat',
    icon: ClipboardList,
    iconColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-500/10',
  },
  {
    id: 'low-stock',
    label: 'Low Stock Alerts',
    value: '3',
    delta: 'need reordering',
    trend: 'down',
    icon: AlertTriangle,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-500/10',
  },
];

export interface PipelineStage {
  id: string;
  label: string;
  count: number;
  barClassName: string;
  barTextClassName: string;
  textClassName: string;
}

export const pipelineStages: PipelineStage[] = [
  { id: 'lead', label: 'Leads', count: 24, barClassName: 'bg-purple-500', barTextClassName: 'text-white', textClassName: 'text-purple-700 dark:text-purple-300' },
  { id: 'prospect', label: 'Prospects', count: 17, barClassName: 'bg-blue-500', barTextClassName: 'text-white', textClassName: 'text-blue-700 dark:text-blue-300' },
  { id: 'customer', label: 'Customers Won', count: 9, barClassName: 'bg-brand', barTextClassName: 'text-brand-dark', textClassName: 'text-brand-dark' },
];

export interface ActivityItem {
  id: string;
  description: string;
  meta: string;
  time: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

export const recentActivity: ActivityItem[] = [
  {
    id: '1',
    description: 'New lead created — Whitmore Residence',
    meta: 'LEAD-1084',
    time: '12m ago',
    icon: Sparkles,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-500/10',
  },
  {
    id: '2',
    description: 'Sales Order moved to Fabrication',
    meta: 'SO-1042',
    time: '48m ago',
    icon: Wrench,
    iconColor: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-100 dark:bg-orange-500/10',
  },
  {
    id: '3',
    description: 'Vendor bill approved for payment',
    meta: 'VB-2091',
    time: '2h ago',
    icon: FileCheck,
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-500/10',
  },
  {
    id: '4',
    description: 'Inventory count completed',
    meta: 'Warehouse 2',
    time: '3h ago',
    icon: ClipboardCheck,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-500/10',
  },
  {
    id: '5',
    description: 'Requisition submitted for approval',
    meta: 'REQ-118',
    time: '5h ago',
    icon: ClipboardList,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-100 dark:bg-amber-500/10',
  },
];

export interface InventoryAlertItem {
  id: string;
  material: string;
  detail: string;
  severity: 'critical' | 'low';
  swatch: string;
}

export const inventoryAlerts: InventoryAlertItem[] = [
  { id: '1', material: 'Calacatta Gold Quartz', detail: '2 slabs left · Warehouse 1', severity: 'critical', swatch: '#e9e5dd' },
  { id: '2', material: 'Black Galaxy Granite', detail: '1 bundle left · Warehouse 2', severity: 'critical', swatch: '#2b2b2b' },
  { id: '3', material: 'Carrara Marble', detail: '4 slabs left · Warehouse 1', severity: 'low', swatch: '#d8d9d6' },
];

import { Building2, TrendingUp, Truck, Landmark, Boxes } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Visual accent for a module section. Full Tailwind class strings (not composed
 * at runtime) so the scanner keeps them in the build.
 */
export interface GroupAccent {
  /** Icon chip behind the module's lucide glyph. */
  chip: string;
  /** Vertical rail drawn beside the section, ties the rows to their header. */
  rail: string;
  /** Count pill next to the module name. */
  count: string;
}

export interface WorkflowGroup {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: GroupAccent;
  /** Workflow keys owned by this module, in the order they should render. */
  keys: string[];
}

/**
 * How workflows are grouped on the Configure Forms page. Keys mirror the
 * workflows seeded by the backend (see the tenant schema's workflow seed
 * blocks) and the module grouping used by `sidebarNav`. A key listed here that
 * the server doesn't return is simply skipped, so this list can run ahead of a
 * module's rollout. Add a new module by appending a group.
 */
export const WORKFLOW_GROUPS: WorkflowGroup[] = [
  {
    id: 'crm',
    label: 'CRM',
    description: 'Customer relationship management — Leads, Prospects, and Customers.',
    icon: Building2,
    accent: {
      chip: 'bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300',
      rail: 'bg-lime-300 dark:bg-lime-400/40',
      count: 'bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300',
    },
    keys: ['lead', 'prospect', 'customer'],
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'The revenue cycle — from first estimate through invoicing and refunds.',
    icon: TrendingUp,
    accent: {
      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
      rail: 'bg-amber-300 dark:bg-amber-400/40',
      count: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    },
    keys: [
      'estimate',
      'quote',
      'sales_order',
      'installation',
      'invoice',
      'payment',
      'credit_memo',
      'refund',
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    description: 'The procurement cycle — vendors, purchase orders, receipts, and bills.',
    icon: Truck,
    accent: {
      chip: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
      rail: 'bg-sky-300 dark:bg-sky-400/40',
      count: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
    },
    keys: [
      'vendor',
      'requisition',
      'purchase_order',
      'item_receipt',
      'vendor_bill',
      'vendor_payment',
      'vendor_credit',
      'expense',
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'General ledger — Journal Entries move funds between your Bank/Cash accounts.',
    icon: Landmark,
    accent: {
      chip: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
      rail: 'bg-cyan-300 dark:bg-cyan-400/40',
      count: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300',
    },
    // Chart of Accounts has no custom fields / workflow key (master data, not
    // a workflow record) — cash_transfer (Journal Entry) is the only Finance
    // module with one.
    keys: ['cash_transfer'],
  },
];

/** Catch-all for workflows the tenant defined outside the shipped modules. */
export const OTHER_GROUP: WorkflowGroup = {
  id: 'other',
  label: 'Other',
  description: 'Custom workflows not assigned to a module.',
  icon: Boxes,
  accent: {
    chip: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
    rail: 'bg-stone-200 dark:bg-stone-700',
    count: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
  },
  keys: [],
};

export interface GroupedWorkflows<T> {
  group: WorkflowGroup;
  workflows: T[];
}

/** Minimal shape `groupWorkflows` and `filterWorkflows` need off a workflow. */
export interface GroupableWorkflow {
  key: string;
  name?: string;
  description?: string;
}

/**
 * Buckets workflows into their module sections. Each module's rows follow the
 * order declared in `WORKFLOW_GROUPS`, not the server's; anything unclaimed
 * lands in `OTHER_GROUP` in the order it arrived. Empty sections are dropped so
 * a tenant without, say, the Purchases module never sees an empty heading.
 */
export function groupWorkflows<T extends GroupableWorkflow>(all: T[]): GroupedWorkflows<T>[] {
  const byKey = new Map<string, T>();
  for (const wf of all) byKey.set(wf.key.toLowerCase(), wf);

  const claimed = new Set<string>();
  const sections: GroupedWorkflows<T>[] = [];

  for (const group of WORKFLOW_GROUPS) {
    const workflows: T[] = [];
    for (const key of group.keys) {
      const wf = byKey.get(key);
      if (!wf) continue;
      workflows.push(wf);
      claimed.add(key);
    }
    if (workflows.length > 0) sections.push({ group, workflows });
  }

  const leftovers = all.filter((wf) => !claimed.has(wf.key.toLowerCase()));
  if (leftovers.length > 0) sections.push({ group: OTHER_GROUP, workflows: leftovers });

  return sections;
}

/**
 * Narrows a workflow list to those matching a free-text query, checking the
 * display name, the description, and the raw key. The key isn't surfaced in the
 * UI, but matching it lets someone paste one straight from a URL; since keys are
 * just snake_case spellings of the names, such a hit always looks like a name
 * hit. A blank query is a no-op.
 */
export function filterWorkflows<T extends GroupableWorkflow>(all: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((wf) =>
    [wf.name, wf.key, wf.description].some((field) => field?.toLowerCase().includes(q)),
  );
}

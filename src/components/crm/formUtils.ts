export const fieldCls =
  'w-full h-10 px-3.5 py-2.5 text-sm text-stone-900 bg-white border border-stone-300 rounded-[10px] outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed';

export const textareaCls =
  'w-full px-3.5 py-2.5 text-sm text-stone-900 bg-white border border-stone-300 rounded-[10px] outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed resize-none';

export const readonlyCls =
  'w-full min-h-10 px-3.5 py-2.5 text-sm text-stone-900 bg-stone-50 border border-stone-300 rounded-[10px]';

export const fieldLabelCls =
  'block text-xs font-semibold text-stone-900';

export const checkboxLabelCls =
  'text-sm font-medium text-stone-700';

/** Generates a stable DOM id for a form section title — used by section jump nav. */
export function sectionId(title: string): string {
  return `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}

// Fallback colors by state key for tenants where the backend returns no color.
const STATUS_COLOR_MAP: Record<string, string> = {
  // Lead
  lead_new:                    '#64748b',
  lead_in_progress:            '#3b82f6',
  lead_qualified:              '#8b5cf6',
  lead_unqualified:            '#ef4444',
  lead_converted:              '#22c55e',
  lead_dead:                   '#6b7280',
  // Prospect
  prospect_in_discussion:      '#64748b',
  prospect_identified_dms:     '#3b82f6',
  prospect_qualified:          '#8b5cf6',
  prospect_proposal:           '#f59e0b',
  prospect_in_negotiation:     '#f97316',
  prospect_purchasing:         '#a855f7',
  prospect_closed_lost:        '#ef4444',
  // Customer
  customer_closed_won:         '#22c55e',
  customer_renewal:            '#3b82f6',
  customer_closed_lost:        '#ef4444',
  // DesignV2 relational codes
  LQUA: '#8b5cf6',
  LUNQ: '#ef4444',
  PDIS: '#64748b',
  PNEG: '#f97316',
  PPRP: '#f59e0b',
  PIDM: '#3b82f6',
  PPUR: '#a855f7',
  PCLL: '#ef4444',
  CCLW: '#22c55e',
  CCLL: '#ef4444',
  CREN: '#3b82f6',
};

/** Returns the color for a status — uses backend value when present, falls back to the local map. */
export function resolveStatusColor(stateKey: string, backendColor?: string): string {
  return backendColor || STATUS_COLOR_MAP[stateKey] || '#64748b';
}

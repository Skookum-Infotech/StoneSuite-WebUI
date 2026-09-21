export const fieldCls =
  'w-full h-10 px-3.5 py-2.5 text-xs text-stone-900 bg-white border border-stone-300 rounded-[10px] outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed';

export const fieldErrorCls =
  'w-full h-10 px-3.5 py-2.5 text-xs text-stone-900 bg-white border border-red-400 rounded-[10px] outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 ring-1 ring-red-200';

export const textareaCls =
  'w-full px-3.5 py-2.5 text-xs text-stone-900 bg-white border border-stone-300 rounded-[10px] outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed resize-none';

export const textareaErrorCls =
  'w-full px-3.5 py-2.5 text-xs text-stone-900 bg-white border border-red-400 rounded-[10px] outline-none transition-all duration-150 placeholder:text-stone-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 ring-1 ring-red-200 resize-none';

export const readonlyCls =
  'w-full min-h-10 px-3.5 py-2.5 text-xs text-stone-900 bg-stone-50 border border-stone-300 rounded-[10px]';

export const fieldLabelCls =
  'block text-xs font-semibold text-stone-900';

export const checkboxLabelCls =
  'text-xs font-medium text-stone-700';

/** Generates a stable DOM id for a form section title — used by section jump nav. */
export function sectionId(title: string): string {
  return `form-section-${title.toLowerCase().replace(/[\s/]+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
}

/** Parses a number-type field's raw input string into the value it should be
 *  stored as: '' when empty, the parsed number otherwise. Never returns NaN —
 *  an unparseable value (e.g. a bare "-" mid-type, or text a paste slipped
 *  past the native `<input type="number">` filter) falls back to '' instead,
 *  so a stray invalid keystroke can't silently reach a payload as `null`
 *  (JSON.stringify(NaN) === 'null'). */
export function parseNumberFieldValue(raw: string): number | '' {
  if (raw === '') return '';
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : '';
}

/** Strips a phone-type field's raw input down to phone-like characters —
 *  digits, a leading '+', spaces, dashes, dots and parentheses. Unlike
 *  `type="number"`, the browser's native `type="tel"` applies no keystroke
 *  filtering at all (by design, since phone formats vary by locale), so
 *  without this a phone/fax field accepts arbitrary text. Applied on every
 *  keystroke rather than only at submit so letters never appear in the
 *  field, matching how a real phone keypad behaves. */
export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/[^\d+\-() .]/g, '');
}

/** Merges a selected dial code into a phone field's sanitized value, for
 *  PhoneNumberInput's country-code selector. Skips prepending when the
 *  sanitized text already starts with '+' (already-coded data, or a value
 *  mid-edit) so editing an existing number never doubles up a code — only
 *  a fresh, code-less value gets one added. */
export function applyCountryCode(code: string, raw: string): string {
  const sanitized = sanitizePhoneInput(raw);
  if (sanitized === '') return '';
  if (sanitized.startsWith('+')) return sanitized;
  return `${code} ${sanitized}`;
}

/** Inverse of applyCountryCode, for display: strips a leading `code` (and
 *  the space applyCountryCode joins it with) off a phone field's stored
 *  value, so PhoneNumberInput's text box never shows the code its own
 *  selector already displays. Only strips an exact match on the given code —
 *  a value that doesn't start with it (untouched legacy data, or one just
 *  re-coded via the dropdown before the value catches up) is returned as-is
 *  rather than guessed at. */
export function stripCountryCode(code: string, value: string): string {
  return value.startsWith(code) ? value.slice(code.length).trimStart() : value;
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
  LNEW: '#64748b',
  PNEW: '#64748b',
  CDRF: '#a8a29e',
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

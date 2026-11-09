import { formatMoney } from '@/lib/formatMoney';
import { resolveReportRange } from '@/lib/reportDateRange';
import type {
  CatalogSource,
  CustomAggFn,
  CustomCell,
  CatalogField,
  CustomFieldType,
  CustomFilterRule,
  CustomOperator,
  CustomReportDefinition,
  CustomTotal,
} from '@/types/customReports';

/** How many of a source's own fields a brand-new report starts with. */
const DEFAULT_COLUMN_COUNT = 3;
const MAX_NUMBER_DECIMALS = 4;
const EMPTY_CELL = '—';
const TOTAL_PREFIX = 'total:';

const NUMERIC_OPERATORS: CustomOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty'];

const OPERATORS: Record<CustomFieldType, CustomOperator[]> = {
  text: ['eq', 'neq', 'contains', 'in', 'is_empty'],
  number: NUMERIC_OPERATORS,
  money: NUMERIC_OPERATORS,
  date: ['date_range', 'is_empty'],
  status: ['in'],
};

const AGG_TITLES: Record<Exclude<CustomAggFn, 'count'>, string> = {
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
};

/** The comparisons a field of this type supports, in the order the builder lists them (mirrors the server). */
export function operatorsFor(type: CustomFieldType): CustomOperator[] {
  return OPERATORS[type];
}

/** A new report on `source`: its first few own fields as columns, no chart. */
export function emptyDefinition(source: CatalogSource): CustomReportDefinition {
  return {
    source: source.key,
    columns: source.fields.filter((f) => f.group === '').slice(0, DEFAULT_COLUMN_COUNT).map((f) => f.key),
    filters: [],
    totals: [],
    chart: 'none',
  };
}

/** Fills each relative date filter's window from `now`, so a saved "This
 *  quarter" report always runs on today's quarter. Custom ranges are kept. */
export function resolveDateFilters(def: CustomReportDefinition, now: Date): CustomReportDefinition {
  return {
    ...def,
    filters: def.filters.map((rule) => {
      if (rule.op !== 'date_range' || !rule.preset || rule.preset === 'custom') return rule;
      const { from, to } = resolveReportRange(rule.preset, now);
      return { ...rule, values: [from, to] };
    }),
  };
}

function totalIndex(key: string): number | null {
  if (!key.startsWith(TOTAL_PREFIX)) return null;
  const n = Number(key.slice(TOTAL_PREFIX.length));
  return Number.isInteger(n) ? n : null;
}

function totalKeyIsValid(key: string, totalCount: number): boolean {
  const index = totalIndex(key);
  return index !== null && index >= 0 && index < totalCount;
}

/** Drops whatever a saved definition names that the catalog no longer has (a
 *  field removed from the app, a source the user lost) and says what it
 *  dropped, so the builder can warn instead of failing. */
export function pruneUnknownFields(
  def: CustomReportDefinition,
  source: CatalogSource,
): { definition: CustomReportDefinition; removed: string[] } {
  const known = new Set(source.fields.map((f) => f.key));
  const removed: string[] = [];
  const keep = (key: string): boolean => {
    if (known.has(key)) return true;
    if (!removed.includes(key)) removed.push(key);
    return false;
  };

  const columns = def.columns.filter(keep);
  const filters = def.filters.filter((f) => keep(f.field));
  const groupBy = def.groupBy && keep(def.groupBy.field) ? def.groupBy : undefined;
  const totals = def.totals.filter((t: CustomTotal) => t.fn === 'count' || (t.field !== undefined && keep(t.field)));

  let sort = def.sort;
  if (sort) {
    const isGroupedKey = sort.key === 'group' || totalIndex(sort.key) !== null;
    const stillValid = isGroupedKey
      ? groupBy !== undefined && (sort.key === 'group' || totalKeyIsValid(sort.key, totals.length))
      : groupBy === undefined && columns.includes(sort.key);
    if (!stillValid) sort = undefined;
  }

  const chart = def.chart === 'bar' && groupBy && totals.length > 0 ? 'bar' : 'none';
  const definition: CustomReportDefinition = { ...def, columns, filters, totals, chart };
  if (groupBy) definition.groupBy = groupBy;
  else delete definition.groupBy;
  if (sort) definition.sort = sort;
  else delete definition.sort;
  return { definition, removed };
}

function labelOf(source: CatalogSource, key: string): string {
  return source.fields.find((f) => f.key === key)?.label ?? key;
}

export function totalLabel(total: CustomTotal, source: CatalogSource): string {
  if (total.fn === 'count') return 'Count';
  return `${AGG_TITLES[total.fn]} of ${labelOf(source, total.field ?? '')}`;
}

function plural(n: number, noun: string): string {
  return n === 1 ? `1 ${noun}` : `${n} ${noun}s`;
}

/** A one-line reading of a report, e.g. "Invoice lines grouped by Customer
 *  name · Sum of Net amount" (same wording as the server's). */
export function describeDefinition(def: CustomReportDefinition, source: CatalogSource): string {
  const parts: string[] = [];
  if (def.groupBy) {
    const bucket = def.groupBy.dateBucket ? ` (${def.groupBy.dateBucket})` : '';
    parts.push(`${source.label} grouped by ${labelOf(source, def.groupBy.field)}${bucket}`);
    if (def.totals.length > 0) parts.push(def.totals.map((t) => totalLabel(t, source)).join(', '));
  } else {
    parts.push(source.label, plural(def.columns.length, 'column'));
  }
  if (def.filters.length > 0) parts.push(plural(def.filters.length, 'filter'));
  if (def.topN) parts.push(`top ${def.topN}`);
  return parts.join(' · ');
}

/** A result cell as the table and exports show it. Values arrive from the
 *  server already typed (text, number or an ISO date string). */
export function formatCell(value: CustomCell, type: CustomFieldType): string {
  if (value === null || value === undefined) return EMPTY_CELL;
  if (type === 'money' && typeof value === 'number') return formatMoney(value);
  if (type === 'number' && typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: MAX_NUMBER_DECIMALS });
  }
  return String(value);
}

/** The size of a plain-English request in bytes, which is what the server
 *  limits (not characters). */
export function promptByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The same plain-decimal rule the server applies (digits, sign, fraction,
// exponent); Number() alone would also accept hex like 0x10.
const PLAIN_DECIMAL = /^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?$/;

function isNumberText(raw: string): boolean {
  const cleaned = raw.trim().replace(/,/g, '');
  return PLAIN_DECIMAL.test(cleaned) && Number.isFinite(Number(cleaned));
}

/** True when a filter has everything its comparison needs, so half-edited
 *  rows are kept in the builder but never sent to the server. */
export function isCompleteFilter(rule: CustomFilterRule, type: CustomFieldType): boolean {
  const filled = rule.values.every((v) => v.trim() !== '');
  switch (rule.op) {
    case 'is_empty':
      return true;
    case 'in':
      return rule.values.length >= 1 && filled;
    case 'between':
      return rule.values.length === 2 && rule.values.every(isNumberText);
    case 'date_range': {
      const [from, to] = rule.values;
      return rule.values.length === 2 && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to;
    }
    default:
      if (rule.values.length !== 1 || !filled) return false;
      return type === 'number' || type === 'money' ? isNumberText(rule.values[0]) : true;
  }
}

/** What the server accepts: date presets filled with their dates (kept as the
 *  preset too, so the report stays relative when reopened), thousands
 *  separators stripped from numbers, incomplete or unknown filters left out.
 *  Used for both running and saving, so a report that previews also saves. */
export function saveableDefinition(def: CustomReportDefinition, source: CatalogSource, now: Date): CustomReportDefinition {
  const resolved = resolveDateFilters(def, now);
  const filters: CustomFilterRule[] = [];
  for (const rule of resolved.filters) {
    const field = source.fields.find((f) => f.key === rule.field);
    if (!field) continue;
    const numeric = field.type === 'number' || field.type === 'money';
    const cleaned = numeric ? { ...rule, values: rule.values.map((v) => v.trim().replace(/,/g, '')) } : rule;
    if (isCompleteFilter(cleaned, field.type)) filters.push(cleaned);
  }
  return { ...resolved, filters };
}

/** The definition to actually run: the saveable form, or null while the report
 *  cannot run yet (a list with no columns, a group with no total). */
export function runnableDefinition(
  def: CustomReportDefinition,
  source: CatalogSource,
  now: Date,
): CustomReportDefinition | null {
  if (def.groupBy) {
    const totalsReady = def.totals.length > 0 && def.totals.every((t) => t.fn === 'count' || Boolean(t.field));
    if (!totalsReady) return null;
  } else if (def.columns.length === 0) {
    return null;
  }
  return saveableDefinition(def, source, now);
}

/** The value shape a comparison starts with, so a new or re-targeted filter
 *  row renders the right inputs. A date range starts on a relative preset. */
export function filterDefaults(op: CustomOperator): Pick<CustomFilterRule, 'values' | 'preset'> {
  switch (op) {
    case 'date_range':
      return { values: [], preset: 'this-quarter' };
    case 'between':
      return { values: ['', ''] };
    case 'in':
    case 'is_empty':
      return { values: [] };
    default:
      return { values: [''] };
  }
}

/** A fresh filter on `field`: its first comparison, nothing filled in yet. */
export function newFilterRule(field: CatalogField): CustomFilterRule {
  const op = operatorsFor(field.type)[0];
  return { field: field.key, op, ...filterDefaults(op) };
}

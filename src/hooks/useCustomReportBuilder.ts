import { useReducer, type Dispatch } from 'react';
import { emptyDefinition } from '@/lib/customReportDefinition';
import {
  CUSTOM_MAX_COLUMNS,
  CUSTOM_MAX_FILTERS,
  CUSTOM_MAX_TOP_N,
  CUSTOM_MAX_TOTALS,
  type CatalogSource,
  type CustomChart,
  type CustomFilterRule,
  type CustomGroupBy,
  type CustomReportDefinition,
  type CustomSort,
  type CustomTotal,
} from '@/types/customReports';

export type BuilderAction =
  | { type: 'replace'; definition: CustomReportDefinition }
  | { type: 'setSource'; source: CatalogSource }
  | { type: 'toggleColumn'; key: string }
  | { type: 'addFilter'; rule: CustomFilterRule }
  | { type: 'setFilter'; index: number; rule: CustomFilterRule }
  | { type: 'removeFilter'; index: number }
  | { type: 'setGroupBy'; groupBy: CustomGroupBy | null }
  | { type: 'setTotals'; totals: CustomTotal[] }
  | { type: 'setSort'; sort: CustomSort | null; topN?: number }
  | { type: 'setChart'; chart: CustomChart };

const TOTAL_KEY = /^total:(\d+)$/;

/** Removes the sort when it names something the definition no longer has. */
function withValidSort(def: CustomReportDefinition): CustomReportDefinition {
  if (!def.sort) return def;
  const { key } = def.sort;
  const total = TOTAL_KEY.exec(key);
  const ok = def.groupBy
    ? key === 'group' || (total !== null && Number(total[1]) < def.totals.length)
    : def.columns.includes(key);
  if (ok) return def;
  const { sort: _dropped, ...rest } = def;
  return rest;
}

function withoutGroup(def: CustomReportDefinition): CustomReportDefinition {
  const { groupBy: _group, ...rest } = def;
  return withValidSort({ ...rest, chart: 'none' });
}

/** Every change the builder can make to a definition. Pure: a new object each
 *  time, never a mutation. */
export function builderReducer(def: CustomReportDefinition, action: BuilderAction): CustomReportDefinition {
  switch (action.type) {
    case 'replace':
      return action.definition;
    case 'setSource':
      return emptyDefinition(action.source);
    case 'toggleColumn': {
      if (def.columns.includes(action.key)) {
        return withValidSort({ ...def, columns: def.columns.filter((c) => c !== action.key) });
      }
      if (def.columns.length >= CUSTOM_MAX_COLUMNS) return def;
      return { ...def, columns: [...def.columns, action.key] };
    }
    case 'addFilter':
      return def.filters.length >= CUSTOM_MAX_FILTERS ? def : { ...def, filters: [...def.filters, action.rule] };
    case 'setFilter':
      return { ...def, filters: def.filters.map((f, i) => (i === action.index ? action.rule : f)) };
    case 'removeFilter':
      return { ...def, filters: def.filters.filter((_, i) => i !== action.index) };
    case 'setGroupBy': {
      if (action.groupBy === null) return withoutGroup(def);
      const totals = def.totals.length > 0 ? def.totals : [{ fn: 'count' as const }];
      return withValidSort({ ...def, groupBy: action.groupBy, totals });
    }
    case 'setTotals':
      return withValidSort({ ...def, totals: action.totals.slice(0, CUSTOM_MAX_TOTALS) });
    case 'setSort': {
      const { sort: _old, topN: _oldTop, ...rest } = def;
      const next: CustomReportDefinition = { ...rest };
      if (action.sort) next.sort = action.sort;
      const topN = action.topN === undefined ? def.topN : action.topN;
      if (topN && topN > 0) next.topN = Math.min(topN, CUSTOM_MAX_TOP_N);
      return next;
    }
    case 'setChart':
      return { ...def, chart: action.chart === 'bar' && def.groupBy && def.totals.length > 0 ? 'bar' : 'none' };
  }
}

/** The definition being edited and the one dispatch that changes it. */
export function useCustomReportBuilder(initial: CustomReportDefinition): {
  definition: CustomReportDefinition;
  dispatch: Dispatch<BuilderAction>;
} {
  const [definition, dispatch] = useReducer(builderReducer, initial);
  return { definition, dispatch };
}

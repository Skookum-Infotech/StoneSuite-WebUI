import type { ReportRangePreset } from '@/lib/reportDateRange';

/** Mirrors the backend's custom-report definition (reports/custom_def.go). */
export type CustomFieldType = 'text' | 'number' | 'money' | 'date' | 'status';

export type CustomOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'in'
  | 'is_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'date_range';

export type CustomAggFn = 'sum' | 'count' | 'avg' | 'min' | 'max';

export type CustomDateBucket = 'day' | 'week' | 'month' | 'quarter';

export type CustomChart = 'bar' | 'none';

export interface CustomFilterRule {
  field: string;
  op: CustomOperator;
  values: string[];
  /** Relative range a date filter was picked from, so a saved report stays
   *  relative; the server only ever reads `values`. */
  preset?: ReportRangePreset;
}

export interface CustomGroupBy {
  field: string;
  dateBucket?: CustomDateBucket;
}

export interface CustomTotal {
  fn: CustomAggFn;
  field?: string;
}

export interface CustomSort {
  /** A column's field key, "group", or "total:<index>". */
  key: string;
  desc: boolean;
}

export interface CustomReportDefinition {
  source: string;
  columns: string[];
  filters: CustomFilterRule[];
  groupBy?: CustomGroupBy;
  totals: CustomTotal[];
  sort?: CustomSort;
  topN?: number;
  chart: CustomChart;
}

export interface CatalogField {
  key: string;
  label: string;
  /** '' for the source's own fields, else the linked record ("Customer"). */
  group: string;
  type: CustomFieldType;
  options?: string[];
}

export interface CatalogSource {
  key: string;
  label: string;
  module: string;
  fields: CatalogField[];
}

export interface CustomResultColumn {
  /** A field key, "group", or "total:<index>". */
  key: string;
  label: string;
  type: CustomFieldType;
}

export type CustomCell = string | number | null;

export interface CustomReportResult {
  columns: CustomResultColumn[];
  rows: CustomCell[][];
  /** Aligned to `columns`; null where a column has no total. */
  totals: CustomCell[];
  /** Rows the report matched before grouping, top-N or the row limit. */
  rowCount: number;
  truncated: boolean;
}

export interface SavedCustomReport {
  id: string;
  name: string;
  definition: CustomReportDefinition;
  shared: boolean;
  ownerName: string;
  isMine: boolean;
  updatedAt: string;
}

export interface CustomReportInput {
  name: string;
  definition: CustomReportDefinition;
  shared: boolean;
}

export interface CustomReportInterpretation {
  definition: CustomReportDefinition;
  summary: string;
  /** Parts of the model's reply that were unusable and left out. */
  dropped: string[];
}

export const CUSTOM_PREVIEW_ROW_LIMIT = 500;
export const CUSTOM_EXPORT_ROW_LIMIT = 10000;
export const CUSTOM_MAX_COLUMNS = 20;
export const CUSTOM_MAX_FILTERS = 10;
export const CUSTOM_MAX_TOTALS = 5;
export const CUSTOM_MAX_TOP_N = 100;
export const CUSTOM_REPORT_NAME_MAX = 120;
export const CUSTOM_PROMPT_MAX_BYTES = 2000;

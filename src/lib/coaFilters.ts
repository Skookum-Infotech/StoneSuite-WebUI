// Pure filter-state helpers behind AccountFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors
// on a component file exporting non-component bindings (mirrors
// itemReceiptFilters.ts).
//
// is_active/is_visible/is_postable are deliberately not offered here: the
// table view's "Include inactive"/"Include hidden" switches already cover
// them via the query-param toggles (chartofaccounts.Filters), the same
// mechanism the tree view uses — offering the identical columns twice, once
// as a switch and once as a filter clause, would just be confusing. This
// drawer covers the attributes those switches don't: type, BS/PNL side,
// category/sub-category, and is_system.
import type { FilterClause } from '@/types/tenant';
import type { AccountType, BSPNL } from '@/types/chartOfAccounts';

export interface AccountTableFilterState {
  type: AccountType | '';
  bsPnl: BSPNL | '';
  categoryCode: number | '';
  subCategoryCode: number | '';
  isSystem: '' | 'true' | 'false';
}

export const EMPTY_ACCOUNT_TABLE_FILTER_STATE: AccountTableFilterState = {
  type: '', bsPnl: '', categoryCode: '', subCategoryCode: '', isSystem: '',
};

export function hasActiveAccountFilters(f: AccountTableFilterState): boolean {
  return Boolean(f.type || f.bsPnl || f.categoryCode || f.subCategoryCode || f.isSystem);
}

export function toAccountFilterClauses(f: AccountTableFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.type) clauses.push({ field: 'type', op: 'eq', value: f.type });
  if (f.bsPnl) clauses.push({ field: 'bs_pnl', op: 'eq', value: f.bsPnl });
  if (f.categoryCode) clauses.push({ field: 'category_code', op: 'eq', value: f.categoryCode });
  if (f.subCategoryCode) clauses.push({ field: 'subcategory_code', op: 'eq', value: f.subCategoryCode });
  if (f.isSystem) clauses.push({ field: 'is_system', op: 'eq', value: f.isSystem === 'true' });
  return clauses;
}

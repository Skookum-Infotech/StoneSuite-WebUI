// Pure filter-building logic behind AccountPicker — kept out of the component
// file because eslint-plugin-react-refresh's `vite` preset errors on a
// component file exporting non-component bindings (mirrors
// itemReceiptFilters.ts's identical rationale).
import type { FilterClause } from '@/types/tenant';
import type { AccountType } from '@/types/chartOfAccounts';

/** Builds the `type in [...]` filter clause AccountPicker sends to
 *  POST /accounts/search when restricted to specific account types (e.g.
 *  Journal Entry's From/To accounts require ['bank', 'cash'] — cashtransfer
 *  AD-7). Returns undefined when no restriction is requested, telling the
 *  caller to fall back to the plain GET /accounts endpoint instead — that
 *  endpoint has no `type` query param, so a `type` filter can only be
 *  expressed via the search endpoint's filter engine. */
export function accountPickerTypeFilters(types: AccountType[] | undefined): FilterClause[] | undefined {
  if (!types || types.length === 0) return undefined;
  return [{ field: 'type', op: 'in', value: types }];
}

// Shared rules for a picker's "not found → create it" affordance on the
// master-data pickers that open their create form in a new tab (inventory
// items, chart-of-accounts accounts). Customer/Vendor pickers do a stash-and-
// return round trip instead (lib/recordCreateReturn.ts) because they sit on
// document pages with unsaved state to protect.
import { INVENTORY_ITEM_NEW_PATH, ITEM_NAME_PARAM } from '@/lib/inventoryItemReturn';
import { ACCOUNT_TYPES, type Account, type AccountType } from '@/types/chartOfAccounts';

/** How many name matches the "does it already exist?" lookup reads. An exact
 *  match is looked for among them, so a name that is a substring of many
 *  others could in principle slip past — the backend's name check
 *  (duplicate/duplicate.go) is what actually refuses the duplicate. */
export const EXISTING_MATCH_LIMIT = 25;

export const ACCOUNT_NEW_PARAM = 'new';
export const ACCOUNT_NAME_PARAM = 'name';
export const ACCOUNT_TYPE_PARAM = 'type';
export const CHART_OF_ACCOUNTS_PATH = '/finance/chart-of-accounts';

/** Case- and whitespace-insensitive comparison key for a name — mirrors
 *  duplicate.Key on the backend, so the picker and the server agree on what
 *  "the same name" means. */
export function nameKey(name: string): string {
  return name.trim().split(/\s+/).join(' ').toLowerCase();
}

/** The first record whose any identifying key (name, SKU, code…) equals the
 *  typed term, or null. Used over an all-status lookup, so an Inactive record
 *  counts — that is the whole point. */
export function findExistingMatch<T>(records: T[], term: string, keysOf: (record: T) => string[]): T | null {
  const needle = nameKey(term);
  if (!needle) return null;
  return records.find((record) => keysOf(record).some((key) => nameKey(key) === needle)) ?? null;
}

/** Why an account that exists is not in an account picker's list — the picker
 *  only lists active, visible, postable accounts of the field's allowed types. */
export function accountUnavailableReason(account: Pick<Account, 'isActive' | 'isPostable' | 'isVisible'>): string {
  if (!account.isActive) return 'Inactive';
  if (!account.isPostable) return 'A header account — not postable';
  if (!account.isVisible) return 'Hidden';
  return 'Not available for this field';
}

/** New Inventory Item form, prefilled with the typed name. No `returnTo`: it
 *  opens in its own tab and lands on the item list when saved. */
export function newInventoryItemHref(name: string): string {
  const params = new URLSearchParams();
  const trimmed = name.trim();
  if (trimmed) params.set(ITEM_NAME_PARAM, trimmed);
  const query = params.toString();
  return query ? `${INVENTORY_ITEM_NEW_PATH}?${query}` : INVENTORY_ITEM_NEW_PATH;
}

/** What the Chart of Accounts page should open, read from the URL a picker's
 *  "Create" link points at (newAccountHref) — null for any other visit. */
export function createDrawerFromParams(
  params: URLSearchParams,
): { mode: 'create'; initialName?: string; initialType?: AccountType } | null {
  if (params.get(ACCOUNT_NEW_PARAM) !== '1') return null;
  const name = params.get(ACCOUNT_NAME_PARAM)?.trim();
  const type = params.get(ACCOUNT_TYPE_PARAM);
  return {
    mode: 'create',
    ...(name ? { initialName: name } : {}),
    ...(type && (ACCOUNT_TYPES as readonly string[]).includes(type) ? { initialType: type as AccountType } : {}),
  };
}

/** Chart of Accounts with its New Account drawer opened and prefilled. */
export function newAccountHref(name: string, type?: AccountType): string {
  const params = new URLSearchParams({ [ACCOUNT_NEW_PARAM]: '1' });
  const trimmed = name.trim();
  if (trimmed) params.set(ACCOUNT_NAME_PARAM, trimmed);
  if (type) params.set(ACCOUNT_TYPE_PARAM, type);
  return `${CHART_OF_ACCOUNTS_PATH}?${params.toString()}`;
}

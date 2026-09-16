import type {
  Account, Category, CategorySide, SubCategory,
} from '@/types/chartOfAccounts';
import { MIXED_SIDE } from '@/types/chartOfAccounts';

// Where a chart-of-accounts entry sits. The server enforces that exactly one of
// the two placements is set (chk_coa_placement), so the UI models it as a
// tagged union rather than two independent optional ids — two `number | ''`
// fields would make "both set" and "neither set" representable in the form
// state, and every consumer would have to re-derive which one won.

export type Placement =
  | { kind: 'category'; id: number }
  | { kind: 'subcategory'; id: number };

/** Prefix used to keep the two id spaces apart in a single <select> value —
 *  category 3 and sub-category 3 are different rows in different tables. */
const CATEGORY_PREFIX = 'cat:';
const SUBCATEGORY_PREFIX = 'sub:';

export function encodePlacement(placement: Placement): string {
  return placement.kind === 'category'
    ? `${CATEGORY_PREFIX}${placement.id}`
    : `${SUBCATEGORY_PREFIX}${placement.id}`;
}

/** Parses a <select> value back into a Placement, or null for the empty
 *  "— Select —" option and anything malformed. */
export function decodePlacement(value: string): Placement | null {
  const parse = (raw: string, kind: Placement['kind']): Placement | null => {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? { kind, id } : null;
  };
  if (value.startsWith(CATEGORY_PREFIX)) {
    return parse(value.slice(CATEGORY_PREFIX.length), 'category');
  }
  if (value.startsWith(SUBCATEGORY_PREFIX)) {
    return parse(value.slice(SUBCATEGORY_PREFIX.length), 'subcategory');
  }
  return null;
}

/** The create-payload fragment for a placement — exactly one id, matching what
 *  the server accepts. */
export function placementPayload(
  placement: Placement,
): { categoryId: number } | { subCategoryId: number } {
  return placement.kind === 'category'
    ? { categoryId: placement.id }
    : { subCategoryId: placement.id };
}

/** The side a new account under `placement` will get. A sub-category has no
 *  side of its own — it inherits its category's, which is why this resolves
 *  through the sub-category rather than reading anything off it. Returns
 *  undefined while the reference tree is still loading or the ids don't
 *  resolve; callers must not treat that as "not MIXED". */
export function sideForPlacement(
  placement: Placement | null,
  categories: Category[],
  subCategories: SubCategory[],
): CategorySide | undefined {
  if (!placement) return undefined;
  const categoryId = placement.kind === 'category'
    ? placement.id
    : subCategories.find((s) => s.id === placement.id)?.categoryId;
  if (categoryId === undefined) return undefined;
  return categories.find((c) => c.id === categoryId)?.bsPnl;
}

/** True when the caller must choose BS or PNL explicitly — only under a MIXED
 *  category (9000 System & Control among the seeded rows), where the side is
 *  genuinely ambiguous (AD-2). Everywhere else the server derives it and
 *  ignores anything supplied. */
export function requiresExplicitSide(side: CategorySide | undefined): boolean {
  return side === MIXED_SIDE;
}

/** The placement of an existing account, for showing where it already sits. */
export function placementOf(account: Pick<Account, 'subCategoryId' | 'categoryId'>): Placement {
  return account.subCategoryId
    ? { kind: 'subcategory', id: account.subCategoryId }
    : { kind: 'category', id: account.categoryId };
}

/** Human label for where an account sits, e.g. "1100 — Current Assets" or
 *  "1000 — Assets" for a category-placed one. Kept in one place so the detail
 *  page, the table and the form drawer cannot drift apart on how a
 *  category-placed account reads. */
export function placementLabel(
  account: Pick<Account,
    'subCategoryCode' | 'subCategoryName' | 'categoryCode' | 'categoryName'>,
): string {
  return account.subCategoryCode
    ? `${account.subCategoryCode} — ${account.subCategoryName ?? ''}`.trimEnd()
    : `${account.categoryCode} — ${account.categoryName}`;
}

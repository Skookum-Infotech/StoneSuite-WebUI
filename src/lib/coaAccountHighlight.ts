import { createContext } from 'react';

// Split out of AccountTreeRow.tsx: a file that exports a component alongside
// other values breaks Vite's React Fast Refresh boundary detection
// (react-refresh/only-export-components) -- these two are plain values, not
// components, so they live here instead.

/** The DOM id one row renders itself under — shared between AccountTreeRow
 *  (which sets it) and AccountTreeView's useHighlightOnCreate (which scrolls
 *  to it), so the two can never drift into different string templates. */
export const accountRowDomId = (accountId: string) => `coa-account-row-${accountId}`;

/** Which account, if any, should render highlighted right now — the id of one
 *  just created via the tree's inline "+" actions, for the few seconds its
 *  scroll-to/flash window is open. A context instead of a prop: only ever one
 *  id matters across the whole (recursive, unbounded-depth) row tree, and
 *  threading it down as a 6th prop would both blow past the 5-prop cap on
 *  AccountTreeRow and force every intermediate level to forward something it
 *  has no other use for. */
export const HighlightedAccountContext = createContext<string | null>(null);

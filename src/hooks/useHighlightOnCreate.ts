import { useEffect, useState } from 'react';
import { useValueFlash } from './useValueFlash';

const HIGHLIGHT_DURATION_MS = 2000;

/**
 * Coordinates "scroll to and briefly highlight the row I just created" for a
 * list/tree where that row may not exist in the DOM yet the moment it's
 * created — it can be behind a group the caller only just expanded, or still
 * waiting on the background refetch an invalidated query kicked off. Call
 * `markCreated(id)` right after your own create-success handling (expanding
 * any collapsed ancestors is the caller's job — only it knows the group
 * structure); this then re-checks for the row's element on every `watch`
 * change until it's found, and scrolls to it once it is.
 *
 * `rowId` builds the DOM id a row renders itself under, e.g.
 * `(id) => \`account-row-${id}\``. `watch` should be something that changes
 * once the data behind the row has actually refreshed — a query's result
 * array is the usual choice, since object identity changes on every refetch.
 *
 * `highlightedId` matches the created id for a short window afterward, so a
 * row component can compare it against its own id to render itself flashed.
 */
export function useHighlightOnCreate(rowId: (id: string) => string, watch: unknown) {
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const flashing = useValueFlash(justCreatedId, HIGHLIGHT_DURATION_MS);

  useEffect(() => {
    if (!justCreatedId) return;
    const el = document.getElementById(rowId(justCreatedId));
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Deliberately keyed on `watch`, not just `justCreatedId`: the row usually
    // doesn't exist on the render where justCreatedId is first set (the
    // caller's query is still refetching in the background), so this effect
    // has to re-run and retry once `watch` reflects data that includes it.
    // `rowId` is excluded because it's typically a fresh inline function each
    // render; only the id and the watched data should trigger a re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreatedId, watch]);

  return { highlightedId: flashing ? justCreatedId : null, markCreated: setJustCreatedId };
}

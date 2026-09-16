import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { toast } from 'sonner';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  clearStash, newRecordCreatePath, readStash, resolveRecordCreateReturn, writeStash,
  type RecordCreateKind,
} from '@/lib/recordCreateReturn';

export interface RecordCreateReturn<P, R> {
  /** The page's unsaved state from before it left to create the record — use
   *  it to seed the page's own useState initializers. Null on a normal visit. */
  restored: P | null;
  isRestored: boolean;
  /** The freshly created record, once, right after coming back. Apply it
   *  (e.g. `setCustomer(createdRef)`) and call `consumeCreated`. Null when
   *  nothing was created (a normal visit, or the user cancelled). */
  createdRef: R | null;
  consumeCreated: () => void;
  /** Builds the leave-and-create action from the page's current state.
   *  `onLeave` runs just before navigating away (e.g. `guard.markClean`).
   *  `startCreate` is omitted when the user lacks create permission on the
   *  target record type — the picker then only shows its "not found" warning. */
  provide: (snapshot: P, onLeave?: () => void) => { startCreate?: (name: string) => void };
}

const STASH_FAILED_MESSAGE = "Couldn't hold on to this page's unsaved changes, so you're staying here. Create the record first, then pick it here.";

/**
 * Page half of the "Create Customer"/"Create Vendor" round trip (see
 * lib/recordCreateReturn.ts). A document Add/Edit page calls this once per
 * picker field it owns, seeds its state from `restored`, and passes
 * `provide(snapshot).startCreate` down to that field's CustomerPicker/
 * VendorPicker as `onCreateNew`.
 */
export function useRecordCreateReturn<P, R extends { id: string; name: string }>(
  kind: RecordCreateKind,
  newRecordBasePath: string,
  permission: { resource: string; action: string },
): RecordCreateReturn<P, R> {
  const location = useLocation();
  const navigate = useNavigate();
  const isHistoryPop = useNavigationType() === 'POP';
  const { hasPermission } = useUserPermissions();
  const currentPath = `${location.pathname}${location.search}`;

  const [resolved] = useState(() =>
    resolveRecordCreateReturn<P, R>(readStash(), kind, currentPath, location.state, isHistoryPop));
  const [consumed, setConsumed] = useState(false);

  // Mounting the page a stash points at settles it, whether it was restored
  // or deliberately skipped — so a later fresh visit can't resurrect old work.
  useEffect(() => {
    const stash = readStash();
    if (stash?.kind === kind && stash.returnTo === currentPath) clearStash();
  }, [kind, currentPath]);

  const consumeCreated = useCallback(() => setConsumed(true), []);

  const provide = (snapshot: P, onLeave?: () => void): { startCreate?: (name: string) => void } => ({
    startCreate: hasPermission(permission.resource, permission.action)
      ? (name: string) => {
        if (!writeStash({ kind, returnTo: currentPath, page: snapshot })) {
          toast.error(STASH_FAILED_MESSAGE);
          return;
        }
        onLeave?.();
        navigate(newRecordCreatePath(newRecordBasePath, currentPath, name));
      }
      : undefined,
  });

  return {
    restored: resolved?.page ?? null,
    isRestored: resolved !== null,
    createdRef: resolved && !consumed ? resolved.createdRef : null,
    consumeCreated,
    provide,
  };
}

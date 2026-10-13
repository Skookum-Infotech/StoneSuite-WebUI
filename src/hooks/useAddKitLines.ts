import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryService } from '@/services/inventoryService';
import { emptyKitMessage, expandKit } from '@/lib/kitLines';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

export interface AddKitLinesOptions<D extends { quantity: string }, L extends D & { id: string; lineNo: number }> {
  /** The table's lines as they stand, in order. */
  items: L[];
  onUpdate: (lines: L[]) => void;
  emptyDraft: D;
  /** The table's own "pick a catalogue item" — the same function the picker's
   *  `onPick` uses, so a kit's lines are priced and taxed exactly like lines
   *  picked by hand. */
  applyItem: (draft: D, item: InventoryItem) => D;
  /** Stamps each line with its kit (labelWithKit). Leave out for a table that
   *  shows no kit headings — it then gets the items as plain lines. */
  label?: (draft: D, kit: InventoryKit) => D;
  newId: () => string;
  /** Runs once the lines are in: close the open row, clear its draft. */
  onAdded: () => void;
  /** Why nothing was added (empty kit, load failure). */
  onError: (message: string) => void;
  /** A kit created on the New Kit trip, added as soon as the table opens. */
  returnedKit?: InventoryKit | null;
}

/**
 * Adds a kit to a document's items table: loads its items, runs each through the
 * table's own catalogue-pick logic with the kit's quantity, and appends them.
 * A kit from a picker's search row has only a count, so its items are fetched
 * when it is chosen — always fresh, since the kit may have been edited since the
 * search; a kit that was just created on the New Kit trip already carries them.
 */
export function useAddKitLines<D extends { quantity: string }, L extends D & { id: string; lineNo: number }>(
  options: AddKitLinesOptions<D, L>,
) {
  const [isAddingKit, setIsAddingKit] = useState(false);

  // addKit must stay stable (the returned-kit effect depends on it) yet always
  // see the table's current lines and callbacks.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const addKit = useCallback(async (kit: InventoryKit) => {
    setIsAddingKit(true);
    try {
      const full = kit.members ? kit : await inventoryService.getKit(kit.id);
      const o = latest.current;
      const expansion = expandKit(full, o.emptyDraft, o.applyItem, o.label);
      const message = emptyKitMessage(full, expansion);
      if (message) {
        o.onError(message);
        return;
      }
      const start = o.items.length;
      const lines = expansion.drafts.map((draft, i) => ({ ...draft, id: o.newId(), lineNo: start + i + 1 }) as L);
      o.onUpdate([...o.items, ...lines]);
      o.onAdded();
      if (expansion.skipped > 0) {
        const n = expansion.skipped;
        toast.info(`${n} inactive item${n === 1 ? ' was' : 's were'} left out of “${full.name}”.`);
      }
    } catch (err) {
      latest.current.onError(apiErrorMessage(err, 'Could not load that kit. Please try again.'));
    } finally {
      setIsAddingKit(false);
    }
  }, []);

  const { returnedKit } = options;
  const applied = useRef(false);
  useEffect(() => {
    if (!returnedKit || applied.current) return;
    applied.current = true;
    void addKit(returnedKit);
  }, [returnedKit, addKit]);

  return { addKit, isAddingKit };
}

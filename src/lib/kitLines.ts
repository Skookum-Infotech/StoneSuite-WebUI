// Kit headings on document lines.
//
// A kit is only a heading over a run of ordinary lines. A line added from a kit
// remembers the kit's id (what makes consecutive lines one group) and the name
// the kit had at the time, so renaming or deleting the kit later never rewrites
// a saved document. Nothing about a line's price, tax or stock depends on it.
//
// This module is the pure half: where headings go, how a kit becomes lines, how
// a group is removed. The components that draw the heading row live in
// components/inventory/KitHeadingRow.tsx.

import type { InventoryItem, InventoryKit } from '@/types/inventory';

/** The kit a line was added from. Both unset for an ordinary line. */
export interface KitLabeled {
  kitId?: string;
  kitName?: string;
}

/** A line's kit in the shape a create/update payload takes. A line outside any
 *  kit contributes nothing, so spreading this leaves its payload untouched. */
export function kitPayload(line: KitLabeled): { kitUuid?: string; kitName?: string } {
  return line.kitId ? { kitUuid: line.kitId, kitName: line.kitName || undefined } : {};
}

/** A line's kit as read back from a response: nothing for an ordinary line. */
export function kitFromLine(line: KitLabeled): KitLabeled {
  return line.kitId ? { kitId: line.kitId, kitName: line.kitName ?? '' } : {};
}

/** The heading drawn above the first line of a kit's run. */
export interface KitHeading {
  kitId: string;
  kitName: string;
  /** How many lines the run holds. */
  count: number;
}

/** Where each kit's heading goes, keyed by the id of the line it sits above.
 *  A run is consecutive lines with the same kit id, so a plain line between two
 *  lines of one kit splits them into two runs with a heading each. */
export function kitHeadings<L extends KitLabeled & { id: string }>(
  lines: readonly L[],
): Map<string, KitHeading> {
  const headings = new Map<string, KitHeading>();
  let open: KitHeading | null = null;
  for (const line of lines) {
    if (!line.kitId) {
      open = null;
      continue;
    }
    if (open && open.kitId === line.kitId) {
      open.count += 1;
      continue;
    }
    open = { kitId: line.kitId, kitName: line.kitName ?? '', count: 1 };
    headings.set(line.id, open);
  }
  return headings;
}

/** Removes the whole run whose heading sits above `firstLineId`, and renumbers
 *  what is left. An id that opens no run removes nothing. */
export function removeKitRun<L extends KitLabeled & { id: string; lineNo: number }>(
  lines: readonly L[],
  firstLineId: string,
): L[] {
  const start = lines.findIndex((l) => l.id === firstLineId);
  const kitId = start >= 0 ? lines[start].kitId : undefined;
  if (start < 0 || !kitId) return [...lines];
  let end = start;
  while (end + 1 < lines.length && lines[end + 1].kitId === kitId) end += 1;
  return [...lines.slice(0, start), ...lines.slice(end + 1)].map((l, i) => ({ ...l, lineNo: i + 1 }));
}

/** What adding a kit produced: one draft per usable item, in the kit's order. */
export interface KitExpansion<D> {
  drafts: D[];
  /** Items left out because they are inactive. */
  skipped: number;
}

/** Marks a draft as coming from `kit` — pass it to expandKit for a table that
 *  shows kit headings; a table that does not (Purchases) leaves it out and gets
 *  plain lines. */
export function labelWithKit<D extends KitLabeled>(draft: D, kit: InventoryKit): D {
  return { ...draft, kitId: kit.id, kitName: kit.name };
}

/** Turns a kit into line drafts through the table's own "pick a catalogue item"
 *  logic, so tax, units and amounts come out exactly as if each item had been
 *  picked by hand. The kit's quantity for the item is set first, so the draft's
 *  amounts are calculated from it. Inactive items are skipped and counted.
 *  `label`, when given, stamps each draft with its kit (see labelWithKit). */
export function expandKit<D extends { quantity: string }>(
  kit: InventoryKit,
  emptyDraft: D,
  applyItem: (draft: D, item: InventoryItem) => D,
  label?: (draft: D, kit: InventoryKit) => D,
): KitExpansion<D> {
  const drafts: D[] = [];
  let skipped = 0;
  for (const member of kit.members ?? []) {
    if (member.item.isActive === false) {
      skipped += 1;
      continue;
    }
    const applied = applyItem({ ...emptyDraft, quantity: String(member.quantity) }, member.item);
    drafts.push(label ? label(applied, kit) : applied);
  }
  return { drafts, skipped };
}

/** The sentence that says why a kit added nothing, or '' when it added lines. */
export function emptyKitMessage(kit: InventoryKit, expansion: KitExpansion<unknown>): string {
  if (expansion.drafts.length > 0) return '';
  if (expansion.skipped > 0) return `Every item in “${kit.name}” is inactive, so nothing was added.`;
  return `“${kit.name}” has no items yet. Add some on the kit's page, then pick it again.`;
}

import { describe, expect, it } from 'vitest';
import {
  emptyKitMessage, expandKit, kitFromLine, kitHeadings, kitPayload, labelWithKit, removeKitRun,
  type KitLabeled,
} from './kitLines';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

interface Line extends KitLabeled {
  id: string;
  lineNo: number;
  quantity: string;
  itemName: string;
}

function line(id: string, kitId?: string, kitName?: string): Line {
  return { id, lineNo: Number(id.replace(/\D/g, '')) || 0, quantity: '1', itemName: id, kitId, kitName };
}

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1', sku: 'SKU-1', name: 'Slab', description: '', unitId: 1, unitPrice: 10,
    isActive: true, customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '',
    createdAt: '', updatedAt: '', ...over,
  };
}

function kit(members: InventoryKit['members'], over: Partial<InventoryKit> = {}): InventoryKit {
  return {
    id: 'kit-1', name: 'Kitchen', description: '', isActive: true,
    itemCount: members?.length ?? 0, members, createdAt: '', updatedAt: '', ...over,
  };
}

describe('kitPayload / kitFromLine', () => {
  it('sends the kit id as kitUuid, and nothing for an ordinary line', () => {
    expect(kitPayload({ kitId: 'k1', kitName: 'Kitchen' })).toEqual({ kitUuid: 'k1', kitName: 'Kitchen' });
    expect(kitPayload({})).toEqual({});
    expect(kitPayload({ kitName: 'stray name' })).toEqual({});
  });

  it('reads a line back, dropping a name that has no kit', () => {
    expect(kitFromLine({ kitId: 'k1', kitName: 'Kitchen' })).toEqual({ kitId: 'k1', kitName: 'Kitchen' });
    expect(kitFromLine({ kitName: 'stray' })).toEqual({});
  });
});

describe('kitHeadings', () => {
  it('puts one heading above the first line of each run, with its count', () => {
    const lines = [line('l1', 'k1', 'Kitchen'), line('l2', 'k1', 'Kitchen'), line('l3'), line('l4', 'k2', 'Bath')];

    const headings = kitHeadings(lines);

    expect([...headings.keys()]).toEqual(['l1', 'l4']);
    expect(headings.get('l1')).toEqual({ kitId: 'k1', kitName: 'Kitchen', count: 2 });
    expect(headings.get('l4')).toEqual({ kitId: 'k2', kitName: 'Bath', count: 1 });
  });

  it('splits one kit into two runs when an ordinary line comes between', () => {
    const lines = [line('l1', 'k1', 'Kitchen'), line('l2'), line('l3', 'k1', 'Kitchen')];

    const headings = kitHeadings(lines);

    expect([...headings.keys()]).toEqual(['l1', 'l3']);
    expect(headings.get('l1')?.count).toBe(1);
  });

  it('has no headings when no line is from a kit', () => {
    expect(kitHeadings([line('l1'), line('l2')]).size).toBe(0);
    expect(kitHeadings([]).size).toBe(0);
  });
});

describe('removeKitRun', () => {
  it('removes the whole run and renumbers the rest', () => {
    const lines = [line('l1'), line('l2', 'k1', 'Kitchen'), line('l3', 'k1', 'Kitchen'), line('l4')];

    const next = removeKitRun(lines, 'l2');

    expect(next.map((l) => l.id)).toEqual(['l1', 'l4']);
    expect(next.map((l) => l.lineNo)).toEqual([1, 2]);
  });

  it('leaves a later run of the same kit alone', () => {
    const lines = [line('l1', 'k1', 'Kitchen'), line('l2'), line('l3', 'k1', 'Kitchen')];

    expect(removeKitRun(lines, 'l1').map((l) => l.id)).toEqual(['l2', 'l3']);
  });

  it('removes nothing for a line that opens no run', () => {
    const lines = [line('l1'), line('l2', 'k1', 'Kitchen')];

    expect(removeKitRun(lines, 'l1')).toHaveLength(2);
    expect(removeKitRun(lines, 'missing')).toHaveLength(2);
  });
});

describe('expandKit', () => {
  const empty = { itemName: '', quantity: '', kitId: undefined, kitName: undefined } as Omit<Line, 'id' | 'lineNo'>;
  // Stands in for a table's applyCatalogItem: it must see the kit's quantity.
  const apply = (draft: Omit<Line, 'id' | 'lineNo'>, it: InventoryItem) => ({
    ...draft, itemName: `${it.name} ×${draft.quantity}`,
  });

  it('makes one draft per item, labelled with the kit and carrying its quantity', () => {
    const k = kit([
      { quantity: 2, item: item({ id: 'a', name: 'Countertop' }) },
      { quantity: 0.5, item: item({ id: 'b', name: 'Backsplash' }) },
    ]);

    const { drafts, skipped } = expandKit(k, empty, apply, labelWithKit);

    expect(skipped).toBe(0);
    expect(drafts).toEqual([
      { itemName: 'Countertop ×2', quantity: '2', kitId: 'kit-1', kitName: 'Kitchen' },
      { itemName: 'Backsplash ×0.5', quantity: '0.5', kitId: 'kit-1', kitName: 'Kitchen' },
    ]);
  });

  it('gives plain lines when no labeller is passed (Purchases tables)', () => {
    const k = kit([{ quantity: 3, item: item({ id: 'a', name: 'Faucet' }) }]);

    const { drafts } = expandKit(k, empty, apply);

    expect(drafts).toEqual([{ itemName: 'Faucet ×3', quantity: '3', kitId: undefined, kitName: undefined }]);
  });

  it('leaves out inactive items and counts them', () => {
    const k = kit([
      { quantity: 1, item: item({ id: 'a', name: 'Live' }) },
      { quantity: 1, item: item({ id: 'b', name: 'Retired', isActive: false }) },
    ]);

    const { drafts, skipped } = expandKit(k, empty, apply, labelWithKit);

    expect(drafts.map((d) => d.itemName)).toEqual(['Live ×1']);
    expect(skipped).toBe(1);
  });

  it('treats a kit with no members list as empty', () => {
    expect(expandKit(kit(undefined), empty, apply, labelWithKit)).toEqual({ drafts: [], skipped: 0 });
  });
});

describe('emptyKitMessage', () => {
  const k = kit([]);

  it('is blank when lines were added', () => {
    expect(emptyKitMessage(k, { drafts: [1], skipped: 0 })).toBe('');
  });

  it('explains an empty kit and an all-inactive one differently', () => {
    expect(emptyKitMessage(k, { drafts: [], skipped: 0 })).toContain('has no items yet');
    expect(emptyKitMessage(k, { drafts: [], skipped: 2 })).toContain('inactive');
  });
});

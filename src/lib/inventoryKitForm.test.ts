import { describe, expect, it } from 'vitest';
import {
  addMember, fromKit, kitDefaults, memberFromItem, removeMember, setMemberQuantity, toKitPayload,
  validateKit,
} from './inventoryKitForm';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1', sku: 'CTR-01', name: 'Countertop', description: '', unitId: 1, unitPrice: 10,
    isActive: true, customFields: {}, tracking: 'quantity', thicknessMm: 0, barcode: '',
    createdAt: '', updatedAt: '', ...over,
  };
}

describe('kitDefaults', () => {
  it('starts active and empty, with the name a picker handed over', () => {
    expect(kitDefaults()).toEqual({ name: '', description: '', isActive: true, members: [] });
    expect(kitDefaults('Kitchen').name).toBe('Kitchen');
  });
});

describe('fromKit / toKitPayload', () => {
  const kit: InventoryKit = {
    id: 'kit-1', name: 'Kitchen', description: 'Counters and splash', isActive: false, itemCount: 2,
    members: [
      { quantity: 2, item: item({ id: 'a', name: 'Countertop', sku: 'CTR-01' }) },
      { quantity: 0.5, item: item({ id: 'b', name: 'Backsplash', sku: 'BSP-01', isActive: false }) },
    ],
    createdAt: '', updatedAt: '',
  };

  it('maps a loaded kit to form state, quantities as text', () => {
    expect(fromKit(kit)).toEqual({
      name: 'Kitchen', description: 'Counters and splash', isActive: false,
      members: [
        { itemId: 'a', name: 'Countertop', sku: 'CTR-01', quantity: '2', isActive: true },
        { itemId: 'b', name: 'Backsplash', sku: 'BSP-01', quantity: '0.5', isActive: false },
      ],
    });
  });

  it('round-trips to the write contract, parsing the quantities', () => {
    expect(toKitPayload(fromKit(kit))).toEqual({
      name: 'Kitchen', description: 'Counters and splash', isActive: false,
      members: [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 0.5 }],
    });
  });

  it('trims the name and reads a blank or non-numeric quantity as 0 (validation refuses it)', () => {
    const state = { ...kitDefaults('  Bath  '), members: [{ ...memberFromItem(item()), quantity: 'abc' }] };

    const payload = toKitPayload(state);

    expect(payload.name).toBe('Bath');
    expect(payload.members).toEqual([{ itemId: 'item-1', quantity: 0 }]);
  });

  it('tolerates a kit loaded without a members list', () => {
    expect(fromKit({ ...kit, members: undefined }).members).toEqual([]);
  });
});

describe('validateKit', () => {
  it('needs a name', () => {
    expect(validateKit(kitDefaults('   '))).toEqual([{ key: 'name', label: 'Kit Name' }]);
  });

  it('refuses a zero, negative or blank quantity, naming the item', () => {
    const state = {
      ...kitDefaults('Kitchen'),
      members: [
        { ...memberFromItem(item({ id: 'a', name: 'Countertop' })), quantity: '0' },
        { ...memberFromItem(item({ id: 'b', name: 'Sink' })), quantity: '' },
        { ...memberFromItem(item({ id: 'c', name: 'Faucet' })), quantity: '2' },
      ],
    };

    expect(validateKit(state).map((e) => e.label)).toEqual(['Quantity of Countertop', 'Quantity of Sink']);
  });

  it('accepts an empty kit — items can be added later', () => {
    expect(validateKit(kitDefaults('Kitchen'))).toEqual([]);
  });
});

describe('member editing', () => {
  it('adds an item once, at quantity 1', () => {
    const first = addMember(kitDefaults('K'), item());
    expect(first.added).toBe(true);
    expect(first.state.members).toEqual([{ itemId: 'item-1', name: 'Countertop', sku: 'CTR-01', quantity: '1', isActive: true }]);

    const again = addMember(first.state, item());
    expect(again.added).toBe(false);
    expect(again.state).toBe(first.state);
  });

  it('removes an item and changes a quantity without touching the others', () => {
    let state = addMember(kitDefaults('K'), item({ id: 'a' })).state;
    state = addMember(state, item({ id: 'b', name: 'Sink' })).state;

    state = setMemberQuantity(state, 'b', '3');
    expect(state.members.map((m) => [m.itemId, m.quantity])).toEqual([['a', '1'], ['b', '3']]);

    state = removeMember(state, 'a');
    expect(state.members.map((m) => m.itemId)).toEqual(['b']);
  });
});

// Form state and payload mapping for a kit's own screen (New Kit / Edit Kit).
//
// A kit is a name plus the items it holds, each with the quantity a document
// line gets by default. State is a typed object (not the loose Record the older
// forms use) because the member list is structured. Quantities stay as typed
// text for the number inputs and are parsed once, in toKitPayload.

import type { InventoryItem, InventoryKit, KitInput } from '@/types/inventory';

export const DEFAULT_MEMBER_QUANTITY = '1';

/** One item row in the kit form. */
export interface KitMemberRow {
  /** The item's id (its uuid). */
  itemId: string;
  name: string;
  sku: string;
  quantity: string;
  /** Carried so a retired item can be flagged — it is skipped when the kit is added. */
  isActive: boolean;
}

export interface KitFormState {
  name: string;
  description: string;
  isActive: boolean;
  members: KitMemberRow[];
}

export function kitDefaults(name = ''): KitFormState {
  return { name, description: '', isActive: true, members: [] };
}

export function memberFromItem(item: InventoryItem, quantity: string = DEFAULT_MEMBER_QUANTITY): KitMemberRow {
  return { itemId: item.id, name: item.name, sku: item.sku, quantity, isActive: item.isActive !== false };
}

/** Maps a loaded kit (GET response) back to the Edit form's state. */
export function fromKit(kit: InventoryKit): KitFormState {
  return {
    name: kit.name,
    description: kit.description ?? '',
    isActive: kit.isActive,
    members: (kit.members ?? []).map((m) => memberFromItem(m.item, String(m.quantity))),
  };
}

function parseQuantity(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Maps the form to the whole-object write contract. */
export function toKitPayload(state: KitFormState): KitInput {
  return {
    name: state.name.trim(),
    description: state.description,
    isActive: state.isActive,
    members: state.members.map((m) => ({ itemId: m.itemId, quantity: parseQuantity(m.quantity) })),
  };
}

export interface KitFieldError {
  key: string;
  label: string;
}

/** The checks the server also makes (a name; a positive quantity per item) —
 *  caught here to save a round trip, not as a substitute for its validation. */
export function validateKit(state: KitFormState): KitFieldError[] {
  const errors: KitFieldError[] = [];
  if (!state.name.trim()) errors.push({ key: 'name', label: 'Kit/Package Name' });
  for (const m of state.members) {
    if (parseQuantity(m.quantity) <= 0) {
      errors.push({ key: `member-${m.itemId}`, label: `Quantity of ${m.name}` });
    }
  }
  return errors;
}

/** Puts `item` in the kit unless it is already there. */
export function addMember(state: KitFormState, item: InventoryItem): { state: KitFormState; added: boolean } {
  if (state.members.some((m) => m.itemId === item.id)) return { state, added: false };
  return { state: { ...state, members: [...state.members, memberFromItem(item)] }, added: true };
}

export function removeMember(state: KitFormState, itemId: string): KitFormState {
  return { ...state, members: state.members.filter((m) => m.itemId !== itemId) };
}

export function setMemberQuantity(state: KitFormState, itemId: string, quantity: string): KitFormState {
  return { ...state, members: state.members.map((m) => (m.itemId === itemId ? { ...m, quantity } : m)) };
}

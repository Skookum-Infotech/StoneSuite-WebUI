// The Edges tool's edge types: the list of finishes a shop paints onto sides
// (Ease, Appliance ...), the editor's draft and its checks, and the helpers
// that paint a type onto a side and read the colour back. A side stores only the
// type's id (`PieceEdge.edgeTypeId`); the name, price and colour live on the
// type, so renaming or recolouring one updates every drawing that uses it.

import type { EdgeFinish, EdgePricingType, EdgeType, PieceEdge } from '@/types/drawing';
import { setEdgeSettings } from './edges';

export const EDGE_FINISHES: { id: EdgeFinish; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'raw', label: 'Raw' },
  { id: 'ogee', label: 'Ogee' },
  { id: 'beveled', label: 'Beveled' },
  { id: 'eased', label: 'Eased' },
  { id: 'waterfall', label: 'Waterfall' },
  { id: 'halfBullnose', label: 'Half Bullnose' },
  { id: 'bullnose', label: 'Bullnose' },
];

export const EDGE_PRICING_TYPES: { id: EdgePricingType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
];

export const DEFAULT_EDGE_FINISH: EdgeFinish = 'none';
export const DEFAULT_EDGE_PRICING: EdgePricingType = 'linear';
/** What a new edge type starts out coloured. */
export const DEFAULT_EDGE_COLOR = '#2563eb';

export const MAX_EDGE_NAME_LENGTH = 64;
export const MAX_EDGE_ALIAS_LENGTH = 8;
/** The server's cap (NUMERIC(12,2)). */
export const MAX_EDGE_PRICE = 9_999_999_999.99;
const CENTS = 100;
const PRICE_DECIMALS = 2;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** The fields as the editor holds them: text boxes hold text. */
export interface EdgeTypeDraft {
  name: string;
  pricingType: EdgePricingType;
  price: string;
  alias: string;
  color: string;
  finish: EdgeFinish;
}

/** What the server is sent. */
export type EdgeTypeInput = Omit<EdgeType, 'id' | 'isSystem'>;

export function blankEdgeTypeDraft(): EdgeTypeDraft {
  return {
    name: '', pricingType: DEFAULT_EDGE_PRICING, price: (0).toFixed(PRICE_DECIMALS), alias: '',
    color: DEFAULT_EDGE_COLOR, finish: DEFAULT_EDGE_FINISH,
  };
}

export function draftFromEdgeType(type: EdgeType): EdgeTypeDraft {
  const { name, pricingType, price, alias, color, finish } = type;
  return { name, pricingType, price: price.toFixed(PRICE_DECIMALS), alias, color, finish };
}

export type EdgeTypeCheck = { ok: true; input: EdgeTypeInput } | { ok: false; error: string };

/** The draft as something that can be saved, or the first thing wrong with it.
 *  `editingId` is the type being edited, so it does not clash with its own name. */
export function checkEdgeTypeDraft(draft: EdgeTypeDraft, existing: EdgeType[], editingId?: string): EdgeTypeCheck {
  const name = draft.name.trim();
  const alias = draft.alias.trim();
  const price = draft.price.trim() === '' ? Number.NaN : Number(draft.price);
  const taken = existing.some((t) => t.id !== editingId && t.name.trim().toLowerCase() === name.toLowerCase());
  const problem =
    name === '' ? 'Enter a name for the edge.'
      : name.length > MAX_EDGE_NAME_LENGTH ? 'The name is too long.'
        : taken ? 'An edge with that name already exists.'
          : alias.length > MAX_EDGE_ALIAS_LENGTH ? 'The alias is too long.'
            : !Number.isFinite(price) || price < 0 ? 'Enter a price of zero or more.'
              : price > MAX_EDGE_PRICE ? 'That price is too large.'
                : !COLOR_PATTERN.test(draft.color) ? 'Pick a colour.'
                  : null;
  if (problem) return { ok: false, error: problem };
  return {
    ok: true,
    input: {
      name, alias, pricingType: draft.pricingType, finish: draft.finish, color: draft.color.toLowerCase(),
      price: Math.round(price * CENTS) / CENTS,
    },
  };
}

/** `edges` with side `index` painted as `typeId`. */
export function paintSide(edges: PieceEdge[], index: number, typeId: string): PieceEdge[] {
  return setEdgeSettings(edges, index, { edgeTypeId: typeId });
}

export interface PaintedSide {
  index: number;
  color: string;
}

/** Every side that carries a known edge type, with the colour to draw it in. A
 *  side whose type is not in the list (deleted elsewhere, still loading) is left
 *  unpainted rather than guessed at. */
export function paintedSides(edges: PieceEdge[], types: EdgeType[]): PaintedSide[] {
  const colors = new Map(types.map((t) => [t.id, t.color]));
  return edges.flatMap((edge) => {
    const color = edge.edgeTypeId === undefined ? undefined : colors.get(edge.edgeTypeId);
    return color === undefined ? [] : [{ index: edge.index, color }];
  });
}

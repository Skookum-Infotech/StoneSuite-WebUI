// The Profiles tool's attached-profile types: the list of attached pieces a
// shop paints onto sides (Backsplash, Lamination, Miter Edge, Waterfall ...),
// the editor's draft and its checks, and the helper that paints a type onto a
// side. A side stores only the type's id plus the measurement chosen for that
// one instance (`PieceEdge.attachedProfile`); the name, price, colour, angle
// and finish live on the type, so editing one updates every drawing that uses
// it. Supersedes the old plain splashHeightMm/waterfallHeightMm fields.

import type { AttachedProfile, AttachedProfileType, PieceEdge, ProfileAngle, ProfileFinish, ProfilePricingType } from '@/types/drawing';
import { setEdgeSettings } from './edges';

export const PROFILE_ANGLES: { id: ProfileAngle; label: string }[] = [
  { id: 90, label: '90°' },
  { id: 180, label: '180°' },
  { id: 270, label: '270°' },
];

export const PROFILE_FINISHES: { id: ProfileFinish; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'mitered', label: 'Mitered' },
];

export const PROFILE_PRICING_TYPES: { id: ProfilePricingType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
];

export const DEFAULT_PROFILE_ANGLE: ProfileAngle = 180;
export const DEFAULT_PROFILE_FINISH: ProfileFinish = 'none';
export const DEFAULT_PROFILE_PRICING: ProfilePricingType = 'linear';
/** What a new profile type starts out coloured. */
export const DEFAULT_PROFILE_COLOR = '#2563eb';

export const MAX_PROFILE_NAME_LENGTH = 64;
export const MAX_PROFILE_ALIAS_LENGTH = 8;
/** The server's cap (NUMERIC(12,2)). */
export const MAX_PROFILE_PRICE = 9_999_999_999.99;
/** The server's cap on one measurement preset (about 79"). */
export const MAX_PROFILE_MEASUREMENT_MM = 2000;
export const MAX_PROFILE_MEASUREMENT_PRESETS = 12;
const CENTS = 100;
const PRICE_DECIMALS = 2;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** The fields as the editor holds them: text boxes hold text, including each
 *  measurement preset in the "Measurements" list. */
export interface AttachedProfileTypeDraft {
  name: string;
  pricingType: ProfilePricingType;
  price: string;
  alias: string;
  color: string;
  measurementPresets: string[];
  angle: ProfileAngle;
  finish: ProfileFinish;
}

/** What the server is sent. */
export type AttachedProfileTypeInput = Omit<AttachedProfileType, 'id' | 'isSystem'>;

export function blankAttachedProfileTypeDraft(): AttachedProfileTypeDraft {
  return {
    name: '', pricingType: DEFAULT_PROFILE_PRICING, price: (0).toFixed(PRICE_DECIMALS), alias: '',
    color: DEFAULT_PROFILE_COLOR, measurementPresets: [''], angle: DEFAULT_PROFILE_ANGLE, finish: DEFAULT_PROFILE_FINISH,
  };
}

export function draftFromAttachedProfileType(type: AttachedProfileType): AttachedProfileTypeDraft {
  const { name, pricingType, price, alias, color, measurementPresetsMm, angle, finish } = type;
  return {
    name, pricingType, price: price.toFixed(PRICE_DECIMALS), alias, color,
    measurementPresets: measurementPresetsMm.map(String),
    angle, finish,
  };
}

export type AttachedProfileTypeCheck = { ok: true; input: AttachedProfileTypeInput } | { ok: false; error: string };

/** The draft as something that can be saved, or the first thing wrong with it.
 *  `editingId` is the type being edited, so it does not clash with its own name. */
export function checkAttachedProfileTypeDraft(
  draft: AttachedProfileTypeDraft, existing: AttachedProfileType[], editingId?: string,
): AttachedProfileTypeCheck {
  const name = draft.name.trim();
  const alias = draft.alias.trim();
  const price = draft.price.trim() === '' ? Number.NaN : Number(draft.price);
  const taken = existing.some((t) => t.id !== editingId && t.name.trim().toLowerCase() === name.toLowerCase());
  const presetTexts = draft.measurementPresets.map((p) => p.trim()).filter((p) => p !== '');
  const presets = presetTexts.map(Number);
  const problem =
    name === '' ? 'Enter a name for the profile.'
      : name.length > MAX_PROFILE_NAME_LENGTH ? 'The name is too long.'
        : taken ? 'A profile with that name already exists.'
          : alias.length > MAX_PROFILE_ALIAS_LENGTH ? 'The alias is too long.'
            : !Number.isFinite(price) || price < 0 ? 'Enter a price of zero or more.'
              : price > MAX_PROFILE_PRICE ? 'That price is too large.'
                : !COLOR_PATTERN.test(draft.color) ? 'Pick a colour.'
                  : presets.length === 0 ? 'Add at least one measurement.'
                    : presets.length > MAX_PROFILE_MEASUREMENT_PRESETS ? 'Too many measurements.'
                      : presets.some((p) => !Number.isFinite(p) || p <= 0) ? 'Enter a measurement greater than zero.'
                        : presets.some((p) => p > MAX_PROFILE_MEASUREMENT_MM) ? 'A measurement is too large.'
                          : null;
  if (problem) return { ok: false, error: problem };
  return {
    ok: true,
    input: {
      name, alias, pricingType: draft.pricingType, angle: draft.angle, finish: draft.finish,
      color: draft.color.toLowerCase(), price: Math.round(price * CENTS) / CENTS,
      measurementPresetsMm: presets,
    },
  };
}

/** `edges` with side `index` painted as `profileTypeId` at `measurementMm`. */
export function paintProfileSide(edges: PieceEdge[], index: number, profileTypeId: string, measurementMm: number): PieceEdge[] {
  const attachedProfile: AttachedProfile = { profileTypeId, measurementMm };
  return setEdgeSettings(edges, index, { attachedProfile });
}

export interface PaintedProfileSide {
  index: number;
  type: AttachedProfileType;
  measurementMm: number;
}

/** Every side that carries a known attached-profile type, resolved against
 *  `types`. A side whose type is not in the list (deleted elsewhere, still
 *  loading) is left out rather than guessed at. */
export function paintedProfileSides(edges: PieceEdge[], types: AttachedProfileType[]): PaintedProfileSide[] {
  const byId = new Map(types.map((t) => [t.id, t]));
  return edges.flatMap((edge) => {
    const attached = edge.attachedProfile;
    const type = attached === undefined ? undefined : byId.get(attached.profileTypeId);
    return type === undefined || attached === undefined ? [] : [{ index: edge.index, type, measurementMm: attached.measurementMm }];
  });
}

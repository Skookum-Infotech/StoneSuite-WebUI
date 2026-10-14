import type { AreaKind, FaucetSpreadPosition } from '@/types/createdOrder';

// The area catalog behind the Created Order form. It is data, not branching
// code, so a new area type (or a field moving between areas) is one entry here
// and the form, validation and payload mapper all follow.

/** The per-area inputs that vary between area kinds. Notes and Faucet Spread
 *  are on every area, so they are not listed. */
export type AreaFieldKey =
  | 'color'
  | 'finish'
  | 'edge'
  | 'backsplashHeight'
  | 'sinkModel'
  | 'cooktopModel'
  | 'waterfallQty'
  | 'popUpOutlet'
  | 'halfWall'
  | 'location';

/** Which printed Faucet Spread row an area uses: `wide` is the kitchen-type
 *  row (12" 8" 4" C 4" 8" 12"), `narrow` the bath row (8" 4" 2" C 2" 4" 8"). */
export type FaucetSpreadScale = 'wide' | 'narrow';

export interface AreaKindConfig {
  kind: AreaKind;
  label: string;
  /** Inputs this area shows, in display order. */
  fields: readonly AreaFieldKey[];
  spreadScale: FaucetSpreadScale;
  /** May be added more than once, each with a name the customer types. */
  repeatable: boolean;
}

export interface FaucetSpreadOption {
  value: FaucetSpreadPosition;
  label: string;
}

const CORE_FIELDS: readonly AreaFieldKey[] = ['color', 'finish', 'edge', 'backsplashHeight', 'sinkModel'];

export const AREA_KINDS: readonly AreaKindConfig[] = [
  {
    kind: 'kitchen',
    label: 'Kitchen',
    fields: [...CORE_FIELDS, 'cooktopModel', 'waterfallQty'],
    spreadScale: 'wide',
    repeatable: false,
  },
  {
    kind: 'island',
    label: 'Island',
    // The printed form's island block has no Backsplash Height.
    fields: ['color', 'finish', 'edge', 'sinkModel', 'cooktopModel', 'waterfallQty', 'popUpOutlet'],
    spreadScale: 'wide',
    repeatable: false,
  },
  { kind: 'pantry', label: 'Pantry', fields: CORE_FIELDS, spreadScale: 'wide', repeatable: false },
  { kind: 'hutch', label: 'Hutch', fields: CORE_FIELDS, spreadScale: 'wide', repeatable: false },
  { kind: 'utility', label: 'Utility', fields: CORE_FIELDS, spreadScale: 'wide', repeatable: false },
  {
    kind: 'master_bath',
    label: 'Primary / Master Bath',
    fields: [...CORE_FIELDS, 'waterfallQty', 'halfWall'],
    spreadScale: 'narrow',
    repeatable: false,
  },
  {
    kind: 'powder_1',
    label: 'Powder 1',
    fields: [...CORE_FIELDS, 'location'],
    spreadScale: 'narrow',
    repeatable: false,
  },
  {
    kind: 'powder_2',
    label: 'Powder 2',
    fields: [...CORE_FIELDS, 'location'],
    spreadScale: 'narrow',
    repeatable: false,
  },
  { kind: 'bath', label: 'Bath', fields: CORE_FIELDS, spreadScale: 'narrow', repeatable: true },
  { kind: 'custom', label: 'Custom area', fields: CORE_FIELDS, spreadScale: 'narrow', repeatable: true },
];

const AREA_KIND_BY_KEY: ReadonlyMap<AreaKind, AreaKindConfig> = new Map(
  AREA_KINDS.map((config) => [config.kind, config]),
);

/** The catalog entry for `kind`. Every AreaKind has one, so this never misses. */
export function areaKindConfig(kind: AreaKind): AreaKindConfig {
  const config = AREA_KIND_BY_KEY.get(kind);
  if (!config) throw new Error(`Unknown area kind: ${kind}`);
  return config;
}

/** The Faucet Spread tick boxes for each printed row, left to right. */
export const FAUCET_SPREAD_OPTIONS: Record<FaucetSpreadScale, readonly FaucetSpreadOption[]> = {
  wide: [
    { value: 'L12', label: '12"' },
    { value: 'L8', label: '8"' },
    { value: 'L4', label: '4"' },
    { value: 'C', label: 'C' },
    { value: 'R4', label: '4"' },
    { value: 'R8', label: '8"' },
    { value: 'R12', label: '12"' },
  ],
  narrow: [
    { value: 'L8', label: '8"' },
    { value: 'L4', label: '4"' },
    { value: 'L2', label: '2"' },
    { value: 'C', label: 'C' },
    { value: 'R2', label: '2"' },
    { value: 'R4', label: '4"' },
    { value: 'R8', label: '8"' },
  ],
};

/** Whether `field` is one of `kind`'s inputs. */
export function areaHasField(kind: AreaKind, field: AreaFieldKey): boolean {
  return areaKindConfig(kind).fields.includes(field);
}

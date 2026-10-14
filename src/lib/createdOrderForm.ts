import { isInvalidPhoneValue } from '@/lib/phoneValidation';
import { areaKindConfig, FAUCET_SPREAD_OPTIONS } from '@/lib/createdOrderAreas';
import type { AreaFieldKey } from '@/lib/createdOrderAreas';
import type { AreaKind, CreatedOrderArea, CreatedOrderInput } from '@/types/createdOrder';

// Form state, validation and payload mapping for the customer-portal Created
// Order form. Everything here is pure, so it is covered by table-driven tests
// and the page only wires inputs to it.

export const MAX_AREAS = 20;
export const MAX_QTY = 20;
export const MAX_BACKSPLASH_HEIGHT_IN = 96;
/** Step for the Backsplash Height input — quarter-inch cuts. */
export const BACKSPLASH_HEIGHT_STEP = 0.25;

export const NAME_MAX_LENGTH = 120;
export const ADDRESS_MAX_LENGTH = 200;
export const ZIP_MAX_LENGTH = 12;
export const NOTES_MAX_LENGTH = 1000;
export const INSTRUCTIONS_MAX_LENGTH = 2000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type HeaderField = Exclude<keyof CreatedOrderInput, 'areas'>;

export const HEADER_FIELD_LABELS: Record<HeaderField, string> = {
  builder: 'Builder',
  community: 'Community',
  plan: 'Plan',
  phone: 'Phone',
  email: 'Email',
  installAddress: 'Install Address',
  city: 'City',
  zip: 'ZIP',
  measureDate: 'Measure Date',
  installDate: 'Install Date',
  specialInstructions: 'Special Instructions',
};

/** Header fields the customer must fill. Plan and Special Instructions are
 *  optional — the printed form leaves both blank on plenty of orders. */
export const REQUIRED_HEADER_FIELDS: readonly HeaderField[] = [
  'builder',
  'community',
  'phone',
  'email',
  'installAddress',
  'city',
  'zip',
  'measureDate',
  'installDate',
];

/** One area while it is being edited. `key` is a client-only id so React keeps
 *  each card's state stable as areas are added and removed. */
export interface AreaDraft extends CreatedOrderArea {
  key: string;
}

/** Sets one input of an area; `value` is typed to the field it names. */
export type AreaFieldChange = <K extends keyof AreaDraft>(field: K, value: AreaDraft[K]) => void;

export interface CreatedOrderFormState extends Omit<CreatedOrderInput, 'areas'> {
  areas: AreaDraft[];
}

export type AreaErrorField = 'name' | 'color' | 'backsplashHeight';

export interface CreatedOrderErrors {
  header: Partial<Record<HeaderField, string>>;
  areas: Record<string, Partial<Record<AreaErrorField, string>>>;
  /** Set when the order has no areas at all. */
  noAreas?: string;
}

export function createdOrderDefaults(): CreatedOrderFormState {
  return {
    builder: '',
    community: '',
    plan: '',
    phone: '',
    email: '',
    installAddress: '',
    city: '',
    zip: '',
    measureDate: '',
    installDate: '',
    specialInstructions: '',
    areas: [],
  };
}

/** The name a newly-added area starts with: the kind's label, numbered when the
 *  customer already has one of a repeatable kind ("Bath", "Bath 2", …). */
export function defaultAreaName(kind: AreaKind, existing: readonly AreaDraft[]): string {
  const { label, repeatable } = areaKindConfig(kind);
  if (!repeatable) return label;
  const sameKind = existing.filter((area) => area.kind === kind).length;
  return sameKind === 0 ? label : `${label} ${sameKind + 1}`;
}

export function newAreaDraft(kind: AreaKind, key: string, existing: readonly AreaDraft[]): AreaDraft {
  return {
    key,
    kind,
    name: defaultAreaName(kind, existing),
    color: '',
    finish: '',
    edge: '',
    backsplashHeight: '',
    sinkModel: '',
    cooktopModel: '',
    waterfallQty: 0,
    popUpOutlet: 0,
    halfWall: false,
    location: '',
    faucetSpread: [],
    notes: '',
  };
}

/** Kinds that may still be added: a non-repeatable kind drops off once present. */
export function addableKinds(kinds: readonly AreaKind[], areas: readonly AreaDraft[]): AreaKind[] {
  return kinds.filter((kind) => areaKindConfig(kind).repeatable || !areas.some((a) => a.kind === kind));
}

function isBlank(value: string): boolean {
  return value.trim() === '';
}

function headerErrors(form: CreatedOrderFormState): CreatedOrderErrors['header'] {
  const errors: CreatedOrderErrors['header'] = {};

  for (const field of REQUIRED_HEADER_FIELDS) {
    if (isBlank(form[field])) errors[field] = `${HEADER_FIELD_LABELS[field]} is required.`;
  }
  if (!errors.phone && isInvalidPhoneValue(form.phone)) {
    errors.phone = 'Enter a valid phone number.';
  }
  if (!errors.email && !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!errors.installDate && !errors.measureDate && form.installDate < form.measureDate) {
    errors.installDate = 'Install Date cannot be before the Measure Date.';
  }
  return errors;
}

function areaErrors(area: AreaDraft): Partial<Record<AreaErrorField, string>> {
  const errors: Partial<Record<AreaErrorField, string>> = {};

  if (isBlank(area.name)) errors.name = 'Give this area a name.';
  if (isBlank(area.color)) errors.color = 'Color is required.';

  if (!isBlank(area.backsplashHeight)) {
    const height = Number(area.backsplashHeight);
    if (!Number.isFinite(height) || height < 0 || height > MAX_BACKSPLASH_HEIGHT_IN) {
      errors.backsplashHeight = `Enter a height between 0 and ${MAX_BACKSPLASH_HEIGHT_IN} inches.`;
    }
  }
  return errors;
}

export function validateCreatedOrder(form: CreatedOrderFormState): CreatedOrderErrors {
  const areas: CreatedOrderErrors['areas'] = {};
  for (const area of form.areas) {
    const errors = areaErrors(area);
    if (Object.keys(errors).length > 0) areas[area.key] = errors;
  }
  return {
    header: headerErrors(form),
    areas,
    noAreas: form.areas.length === 0 ? 'Add at least one area to your order.' : undefined,
  };
}

/** How many separate problems remain — what the summary panel counts down. */
export function countErrors(errors: CreatedOrderErrors): number {
  const areaCount = Object.values(errors.areas).reduce(
    (sum, fieldErrors) => sum + Object.keys(fieldErrors).length,
    0,
  );
  return Object.keys(errors.header).length + areaCount + (errors.noAreas ? 1 : 0);
}

const TEXT_FIELDS: readonly AreaFieldKey[] = [
  'color',
  'finish',
  'edge',
  'backsplashHeight',
  'sinkModel',
  'cooktopModel',
  'location',
];

/** "n of m" for an area card's hint. Counts the text inputs the area shows plus
 *  Faucet Spread; quantities and Half Wall are optional toggles, so they are
 *  not part of "filled". */
export function areaProgress(area: AreaDraft): { filled: number; total: number } {
  const textFields = areaKindConfig(area.kind).fields.filter((field) => TEXT_FIELDS.includes(field));
  const filledText = textFields.filter((field) => {
    const value = area[field];
    return typeof value === 'string' && !isBlank(value);
  }).length;
  return {
    filled: filledText + (area.faucetSpread.length > 0 ? 1 : 0),
    total: textFields.length + 1,
  };
}

/** `target` with `source`'s Color, Finish and Edge — the "same stone
 *  everywhere" shortcut. */
export function copyStone(source: AreaDraft, target: AreaDraft): AreaDraft {
  return { ...target, color: source.color, finish: source.finish, edge: source.edge };
}

/** The area `areaKey` can copy its stone from: the first other area that has a
 *  Color filled in, or undefined when there is none (the shortcut is then
 *  hidden rather than copying blanks). */
export function stoneSource(areas: readonly AreaDraft[], areaKey: string): AreaDraft | undefined {
  return areas.find((area) => area.key !== areaKey && !isBlank(area.color));
}

function toAreaPayload(area: AreaDraft): CreatedOrderArea {
  const config = areaKindConfig(area.kind);
  const has = (field: AreaFieldKey): boolean => config.fields.includes(field);
  const text = (field: AreaFieldKey, value: string): string => (has(field) ? value.trim() : '');
  const spreadOrder = FAUCET_SPREAD_OPTIONS[config.spreadScale].map((option) => option.value);

  return {
    kind: area.kind,
    name: area.name.trim(),
    color: text('color', area.color),
    finish: text('finish', area.finish),
    edge: text('edge', area.edge),
    backsplashHeight: text('backsplashHeight', area.backsplashHeight),
    sinkModel: text('sinkModel', area.sinkModel),
    cooktopModel: text('cooktopModel', area.cooktopModel),
    waterfallQty: has('waterfallQty') ? area.waterfallQty : 0,
    popUpOutlet: has('popUpOutlet') ? area.popUpOutlet : 0,
    halfWall: has('halfWall') ? area.halfWall : false,
    location: text('location', area.location),
    faucetSpread: spreadOrder.filter((position) => area.faucetSpread.includes(position)),
    notes: area.notes.trim(),
  };
}

/** The request body: trimmed text, no client keys, and any value an area's kind
 *  does not show (left over from a copy or an edit) reset to empty. */
export function toCreatePayload(form: CreatedOrderFormState): CreatedOrderInput {
  return {
    builder: form.builder.trim(),
    community: form.community.trim(),
    plan: form.plan.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    installAddress: form.installAddress.trim(),
    city: form.city.trim(),
    zip: form.zip.trim(),
    measureDate: form.measureDate,
    installDate: form.installDate,
    specialInstructions: form.specialInstructions.trim(),
    areas: form.areas.map(toAreaPayload),
  };
}

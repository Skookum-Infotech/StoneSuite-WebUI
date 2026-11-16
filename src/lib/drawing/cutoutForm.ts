// The Cutout dialog's form: what is typed (text, in the drawing's display
// unit) and how it becomes a Cutout. Kept apart from the component so the
// parsing and the "what does a new sink start as" rules are plain functions.

import type { Cutout, CutoutType, DistanceLines, Point } from '@/types/drawing';
import { MM_PER_INCH } from './constants';
import { CUTOUT_DEFAULTS, cutoutSize } from './cutouts';
import { formatLength, LengthParseError, parseLength, parsePositiveLength } from './units';

/** The one type that comes with faucet holes. */
export const FAUCET_HOLE_TYPE: CutoutType = 'sink';

export interface DisplayFormat {
  unit: 'in' | 'mm';
  fractionDenominator: 16 | 32;
}

export interface CutoutDraft {
  type: CutoutType;
  name: string;
  hideName: boolean;
  length: string;
  height: string;
  hideMeasurements: boolean;
  edgeCode: string;
  faucetHoleCount: string;
  faucetHoleRadius: string;
  distanceLines: DistanceLines;
}

export type DraftErrors = Partial<Record<'length' | 'height' | 'faucetHoleCount' | 'faucetHoleRadius', string>>;

const DEFAULT_FAUCET_HOLE_RADIUS_MM = 1.25 * MM_PER_INCH;

/** The name a new cutout of this type starts with ("Cutout - Sink"). */
export const defaultCutoutName = (typeLabel: string): string => `Cutout - ${typeLabel}`;

/** Distances measured to the left and bottom edges from the centre, none
 *  drawn to the top or right — what the dialog opens with. */
export const defaultDistanceLines = (): DistanceLines => ({
  top: 'hidden', right: 'hidden', bottom: 'center', left: 'center',
});

/** The starting length x height for a type, as text in the display unit. A
 *  round type (a faucet) starts square at its diameter. */
export function defaultSizeText(type: CutoutType, format: DisplayFormat): { length: string; height: string } {
  const { widthMm, depthMm, diameterMm } = CUTOUT_DEFAULTS[type];
  const show = (mm: number | undefined) => formatLength(mm ?? diameterMm ?? 0, format.unit, format.fractionDenominator);
  return { length: show(widthMm), height: show(depthMm) };
}

export function newDraft(type: CutoutType, typeLabel: string, format: DisplayFormat): CutoutDraft {
  return {
    type,
    name: defaultCutoutName(typeLabel),
    hideName: false,
    ...defaultSizeText(type, format),
    hideMeasurements: false,
    edgeCode: '',
    faucetHoleCount: '',
    faucetHoleRadius: formatLength(DEFAULT_FAUCET_HOLE_RADIUS_MM, format.unit, format.fractionDenominator),
    distanceLines: defaultDistanceLines(),
  };
}

/** The draft an existing cutout fills the form with, so it can be edited again. */
export function draftFromCutout(cutout: Cutout, typeLabel: string, format: DisplayFormat): CutoutDraft {
  const { lengthMm, heightMm } = cutoutSize(cutout);
  const show = (mm: number) => formatLength(mm, format.unit, format.fractionDenominator);
  return {
    type: cutout.type,
    name: cutout.label ?? defaultCutoutName(typeLabel),
    hideName: cutout.hideName ?? false,
    length: show(lengthMm),
    height: show(heightMm),
    hideMeasurements: cutout.hideMeasurements ?? false,
    edgeCode: cutout.edgeCode ?? '',
    faucetHoleCount: cutout.faucetHoleCount === undefined ? '' : String(cutout.faucetHoleCount),
    faucetHoleRadius: show(cutout.faucetHoleRadiusMm ?? DEFAULT_FAUCET_HOLE_RADIUS_MM),
    distanceLines: cutout.distanceLines ?? defaultDistanceLines(),
  };
}

/** Everything the form owns on a cutout, as an update: a field the form left
 *  empty is cleared (undefined) rather than keeping its old value. Position,
 *  rotation and the inventory item are not the form's and stay as they are. */
export function cutoutPatch(edited: Cutout): Partial<Cutout> {
  return {
    type: edited.type,
    shape: edited.shape,
    widthMm: edited.widthMm,
    depthMm: edited.depthMm,
    diameterMm: undefined,
    outline: undefined,
    label: edited.label,
    hideName: edited.hideName,
    hideMeasurements: edited.hideMeasurements,
    edgeCode: edited.edgeCode,
    faucetHoleCount: edited.faucetHoleCount,
    faucetHoleRadiusMm: edited.faucetHoleRadiusMm,
    distanceLines: edited.distanceLines,
  };
}

function lengthError(e: unknown): string {
  return e instanceof LengthParseError ? e.message : 'Enter a value.';
}

function parseCount(text: string): number | string | undefined {
  if (text.trim() === '') return undefined;
  const count = Number(text);
  return Number.isInteger(count) && count >= 0 ? count : 'Enter a whole number, zero or more.';
}

export type DraftResult = { cutout: Cutout; errors?: undefined } | { cutout?: undefined; errors: DraftErrors };

/** The cutout the draft describes, centred on `center` — or what is wrong
 *  with each field that cannot be read. */
export function draftToCutout(draft: CutoutDraft, id: string, center: Point): DraftResult {
  const errors: DraftErrors = {};
  const size = (field: 'length' | 'height'): number => {
    try {
      return parsePositiveLength(draft[field]);
    } catch (e) {
      errors[field] = lengthError(e);
      return 0;
    }
  };
  const widthMm = size('length');
  const depthMm = size('height');

  let faucetHoleCount: number | undefined;
  let faucetHoleRadiusMm: number | undefined;
  if (draft.type === FAUCET_HOLE_TYPE) {
    const count = parseCount(draft.faucetHoleCount);
    if (typeof count === 'string') errors.faucetHoleCount = count;
    else faucetHoleCount = count;
    if (draft.faucetHoleRadius.trim() !== '') {
      try {
        faucetHoleRadiusMm = parseLength(draft.faucetHoleRadius);
        if (faucetHoleRadiusMm < 0) errors.faucetHoleRadius = 'A radius cannot be negative.';
      } catch (e) {
        errors.faucetHoleRadius = lengthError(e);
      }
    }
  }
  if (Object.keys(errors).length > 0) return { errors };

  const name = draft.name.trim();
  return {
    cutout: {
      id,
      type: draft.type,
      shape: 'rect',
      center,
      rotationDeg: 0,
      widthMm,
      depthMm,
      ...(name && { label: name }),
      ...(draft.hideName && { hideName: true }),
      ...(draft.hideMeasurements && { hideMeasurements: true }),
      ...(draft.edgeCode && { edgeCode: draft.edgeCode }),
      ...(faucetHoleCount !== undefined && { faucetHoleCount }),
      ...(faucetHoleRadiusMm !== undefined && { faucetHoleRadiusMm }),
      distanceLines: draft.distanceLines,
    },
  };
}

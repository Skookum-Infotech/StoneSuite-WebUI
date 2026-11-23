// The Cutout dialog's form: what is typed (text, in the drawing's display
// unit) and how it becomes a Cutout. Kept apart from the component so the
// parsing and the "what does a new sink start as" rules are plain functions.

import type { Cutout, CutoutShape, CutoutType, DistanceLines, Point } from '@/types/drawing';
import { MM_PER_INCH } from './constants';
import { CUTOUT_DEFAULTS, cutoutSize } from './cutouts';
import {
  findShape, SHAPE_TABS, shapeSizeMm, shapesForType, tabOfGeometry, tabsForType, type ShapeTab,
} from './cutoutShapes';
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
  /** The outline tab the opening sits under (rectangle, arc, ellipse). */
  shapeTab: ShapeTab;
  /** The picture the cutout is drawn as; '' is No Picture. */
  shapeCode: string;
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

/** The starting length x height for a type — or for its picture, when it has
 *  one — as text in the display unit. A round type (a faucet) starts square at
 *  its diameter. */
export function defaultSizeText(
  type: CutoutType, format: DisplayFormat, shapeCode = '',
): { length: string; height: string } {
  const shape = findShape(shapeCode);
  const show = (mm: number) => formatLength(mm, format.unit, format.fractionDenominator);
  if (shape) {
    const { lengthMm, heightMm } = shapeSizeMm(shape);
    return { length: show(lengthMm), height: show(heightMm) };
  }
  const { widthMm, depthMm, diameterMm } = CUTOUT_DEFAULTS[type];
  return { length: show(widthMm ?? diameterMm ?? 0), height: show(depthMm ?? diameterMm ?? 0) };
}

/** The picture a cutout of `type` can keep: its own if that type offers it,
 *  otherwise none. */
export const shapeCodeFor = (type: CutoutType, shapeCode: string): string => (
  shapesForType(type).some((s) => s.code === shapeCode) ? shapeCode : ''
);

/** `tab` if the type offers it, otherwise the type's first tab (rectangle for
 *  a type with no tabs). */
export const tabFor = (type: CutoutType, tab: ShapeTab): ShapeTab => {
  const tabs = tabsForType(type);
  return tabs.includes(tab) ? tab : tabs[0] ?? 'rectangle';
};

/** The outline the opening takes: its picture's, or its tab's. */
export const geometryOf = (draft: Pick<CutoutDraft, 'shapeCode' | 'shapeTab'>): CutoutShape =>
  findShape(draft.shapeCode)?.geometry ?? SHAPE_TABS[draft.shapeTab].geometry;

export function newDraft(type: CutoutType, typeLabel: string, format: DisplayFormat): CutoutDraft {
  return {
    type,
    name: defaultCutoutName(typeLabel),
    hideName: false,
    ...defaultSizeText(type, format),
    hideMeasurements: false,
    shapeTab: tabFor(type, 'rectangle'),
    shapeCode: '',
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
  const picture = findShape(cutout.shapeCode);
  return {
    type: cutout.type,
    name: cutout.label ?? defaultCutoutName(typeLabel),
    hideName: cutout.hideName ?? false,
    length: show(lengthMm),
    height: show(heightMm),
    hideMeasurements: cutout.hideMeasurements ?? false,
    shapeTab: tabFor(cutout.type, picture?.tab ?? tabOfGeometry(cutout.shape)),
    shapeCode: cutout.shapeCode ?? '',
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
    shapeCode: edited.shapeCode,
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
      shape: geometryOf(draft),
      center,
      rotationDeg: 0,
      widthMm,
      depthMm,
      ...(name && { label: name }),
      ...(draft.hideName && { hideName: true }),
      ...(draft.hideMeasurements && { hideMeasurements: true }),
      ...(draft.shapeCode && { shapeCode: draft.shapeCode }),
      ...(draft.edgeCode && { edgeCode: draft.edgeCode }),
      ...(faucetHoleCount !== undefined && { faucetHoleCount }),
      ...(faucetHoleRadiusMm !== undefined && { faucetHoleRadiusMm }),
      distanceLines: draft.distanceLines,
    },
  };
}

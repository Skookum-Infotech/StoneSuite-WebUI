import { AREA_FIELD_LABELS, areaKindConfig, FAUCET_SPREAD_OPTIONS } from '@/lib/createdOrderAreas';
import type { AreaFieldKey } from '@/lib/createdOrderAreas';
import type { AreaKind, CreatedOrderArea, FaucetSpreadPosition } from '@/types/createdOrder';

// Display helpers for the Created Orders list. Kept out of the form logic so the
// list page and the form can change independently.

/** "pending_review" → "Pending review". The server owns the status vocabulary,
 *  so an unknown value is shown readably rather than mapped or dropped. */
export function orderStatusLabel(status: string): string {
  const words = status.trim().replace(/[_-]+/g, ' ');
  if (words === '') return 'Submitted';
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/** "1 area" / "3 areas" — the list's Areas column. */
export function areaCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'area' : 'areas'}`;
}

/** The "Install Address" cell's second line: "City, ZIP" with whichever parts
 *  exist, or '' when neither does. */
export function cityZipLabel(city: string, zip: string): string {
  return [city.trim(), zip.trim()].filter((part) => part !== '').join(', ');
}

const SPREAD_POSITION = /^([LR])(\d+)$/;

/** One Faucet Spread tick as it reads on a submitted order: "8" left",
 *  "Centre", "4" right". */
function spreadPositionText(position: FaucetSpreadPosition): string {
  if (position === 'C') return 'Centre';
  const match = SPREAD_POSITION.exec(position);
  if (!match) return position;
  return `${match[2]}" ${match[1] === 'L' ? 'left' : 'right'}`;
}

/** The ticked Faucet Spread positions, left to right along the row the area's
 *  kind prints, e.g. `8" left, Centre`. '' when none is ticked. */
export function faucetSpreadText(kind: AreaKind, positions: readonly FaucetSpreadPosition[]): string {
  const { spreadScale } = areaKindConfig(kind);
  return FAUCET_SPREAD_OPTIONS[spreadScale]
    .filter((option) => positions.includes(option.value))
    .map((option) => spreadPositionText(option.value))
    .join(', ');
}

export interface AreaDetailRow {
  label: string;
  value: string;
}

const NO_VALUE = '—';

/** The rows an order's detail page shows for one area: every input its kind has,
 *  in form order, with a dash where the customer left it empty, then the Faucet
 *  Spread. Notes are not a row — the page gives them their own block. */
export function areaDetailRows(area: CreatedOrderArea): AreaDetailRow[] {
  const text = (value: string): string => value.trim() || NO_VALUE;
  const count = (value: number): string => (value > 0 ? String(value) : NO_VALUE);
  const valueOf: Record<AreaFieldKey, string> = {
    color: text(area.color),
    finish: text(area.finish),
    edge: text(area.edge),
    backsplashHeight: area.backsplashHeight.trim() ? `${area.backsplashHeight.trim()} in` : NO_VALUE,
    sinkModel: text(area.sinkModel),
    cooktopModel: text(area.cooktopModel),
    waterfallQty: count(area.waterfallQty),
    popUpOutlet: count(area.popUpOutlet),
    halfWall: area.halfWall ? 'Yes' : 'No',
    location: text(area.location),
  };
  const rows = areaKindConfig(area.kind).fields.map((field) => ({
    label: AREA_FIELD_LABELS[field],
    value: valueOf[field],
  }));
  rows.push({ label: 'Faucet Spread', value: faucetSpreadText(area.kind, area.faucetSpread) || NO_VALUE });
  return rows;
}

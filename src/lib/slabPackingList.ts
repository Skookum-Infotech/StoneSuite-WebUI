// Reading slab rows pasted from a supplier's packing list.
//
// A stone supplier's packing list gives every slab's dimensions, often weeks
// before the delivery — in centimetres, inches or millimetres depending on
// where it was cut. Typing a bundle's worth of slabs by hand is slow and easy to
// get wrong, so the receiving form accepts the rows pasted straight from a
// spreadsheet or PDF instead.
//
// One slab per line: length, width, optionally thickness, optionally a lot or
// bundle label — separated by tabs (a spreadsheet paste), commas, spaces or an
// "x". Dimensions are converted to millimetres, which is what a slab is stored
// in. Nothing here is trusted beyond that: the server recomputes every area.

export type PackingListUnit = 'mm' | 'cm' | 'in';

export const PACKING_LIST_UNITS: ReadonlyArray<{ value: PackingListUnit; label: string; mmPerUnit: number }> = [
  { value: 'mm', label: 'Millimetres (mm)', mmPerUnit: 1 },
  { value: 'cm', label: 'Centimetres (cm)', mmPerUnit: 10 },
  { value: 'in', label: 'Inches (in)', mmPerUnit: 25.4 },
];

/** More rows than a container could hold is a paste mistake, not a packing list. */
export const MAX_PASTED_SLABS = 500;

/** Dimensions are stored to hundredths of a millimetre (DECIMAL(10,2)). */
const MM_DECIMALS = 2;
const MM_SCALE = 10 ** MM_DECIMALS;

/** How many numbers a row may carry: length, width, thickness. */
const MAX_DIMENSIONS = 3;
const LENGTH_INDEX = 0;
const WIDTH_INDEX = 1;
const THICKNESS_INDEX = 2;

const NUMBER = /^\d+(?:[.,]\d+)?$/;

export interface PackingListSlab {
  lengthMm: number;
  widthMm: number;
  /** Null when the row has no thickness — the caller supplies a default. */
  thicknessMm: number | null;
  lot: string;
}

export interface PackingListResult {
  slabs: PackingListSlab[];
  /** Rows that could not be read, each naming its line: "Row 3: …". */
  problems: string[];
}

function toMm(value: number, unit: PackingListUnit): number {
  const factor = PACKING_LIST_UNITS.find((u) => u.value === unit)?.mmPerUnit ?? 1;
  return Math.round(value * factor * MM_SCALE) / MM_SCALE;
}

// A spreadsheet paste is tab-separated, so commas inside a cell can be decimal
// commas ("120,5"). Any other paste uses commas as separators.
function tokenise(line: string): { tokens: string[]; tabbed: boolean } {
  if (line.includes('\t')) {
    return { tokens: line.split('\t').map((c) => c.trim()).filter(Boolean), tabbed: true };
  }
  // "3048 x 1524 x 30" and "3048x1524" read as separate numbers.
  const spaced = line.replace(/(\d)\s*[x×*]\s*(?=\d)/gi, '$1 ');
  return { tokens: spaced.split(/[\s,;]+/).filter(Boolean), tabbed: false };
}

// The dimensions are the longest unbroken run of numbers on the row; every
// other token — including a number, like the 7 in "Block 7 East" — belongs to the
// lot label. Taking only a contiguous run is what keeps a numbered lot or bundle
// from being mistaken for a thickness.
function splitDimensions(tokens: string[], tabbed: boolean): { numbers: number[]; rest: string[] } {
  let best = { start: 0, length: 0 };
  let runStart = -1;
  for (let i = 0; i <= tokens.length; i += 1) {
    const numeric = i < tokens.length && NUMBER.test(tokens[i]);
    if (numeric && runStart < 0) runStart = i;
    if (!numeric && runStart >= 0) {
      if (i - runStart > best.length) best = { start: runStart, length: i - runStart };
      runStart = -1;
    }
  }
  const inRun = (i: number) => i >= best.start && i < best.start + best.length;
  return {
    numbers: tokens
      .filter((_, i) => inRun(i))
      .map((t) => parseFloat(tabbed ? t.replace(',', '.') : t)),
    rest: tokens.filter((_, i) => !inRun(i)),
  };
}

/**
 * Parses pasted packing-list text into slabs, all lengths converted from
 * `unit` to millimetres. A header row (a first line with no numbers) is skipped;
 * any other line that can't be read is reported rather than silently dropped, so
 * the receiver sees exactly which rows didn't make it.
 */
export function parsePackingList(text: string, unit: PackingListUnit): PackingListResult {
  const slabs: PackingListSlab[] = [];
  const problems: string[] = [];
  let sawContent = false;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const row = i + 1;
    const raw = lines[i].trim();
    if (!raw) continue;

    const { tokens, tabbed } = tokenise(raw);
    const { numbers, rest: words } = splitDimensions(tokens, tabbed);

    const isFirstContent = !sawContent;
    sawContent = true;
    if (numbers.length === 0) {
      // A heading like "Length  Width  Bundle" — only expected on the first line.
      if (!isFirstContent) problems.push(`Row ${row}: no length or width found.`);
      continue;
    }
    if (numbers.length < WIDTH_INDEX + 1) {
      problems.push(`Row ${row}: needs both a length and a width.`);
      continue;
    }
    if (numbers.length > MAX_DIMENSIONS) {
      problems.push(`Row ${row}: too many numbers — paste only length, width and (optionally) thickness.`);
      continue;
    }
    if (!(numbers[LENGTH_INDEX] > 0 && numbers[WIDTH_INDEX] > 0)) {
      problems.push(`Row ${row}: length and width must be greater than zero.`);
      continue;
    }
    if (numbers.length > THICKNESS_INDEX && !(numbers[THICKNESS_INDEX] > 0)) {
      problems.push(`Row ${row}: thickness must be greater than zero.`);
      continue;
    }
    if (slabs.length >= MAX_PASTED_SLABS) {
      problems.push(`Only the first ${MAX_PASTED_SLABS} slabs are read; the rest were left out.`);
      break;
    }

    slabs.push({
      lengthMm: toMm(numbers[LENGTH_INDEX], unit),
      widthMm: toMm(numbers[WIDTH_INDEX], unit),
      thicknessMm: numbers.length > THICKNESS_INDEX ? toMm(numbers[THICKNESS_INDEX], unit) : null,
      lot: words.join(' '),
    });
  }
  return { slabs, problems };
}

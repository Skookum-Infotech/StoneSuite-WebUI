// Length parsing/formatting for the drawing editor. All geometry is stored
// in millimetres; these are the only two functions that know about inches,
// so every other module (geometry, DXF export, the editor's inputs) stays
// unit-agnostic.

import { DEFAULT_FRACTION_DENOMINATOR, MM_PER_INCH } from './constants';

/** Thrown by parseLength on input that isn't a recognizable length. The
 *  message is written to sit next to the offending input field as-is. */
export class LengthParseError extends Error {}

const MM_VALUE = /^(\d+(?:\.\d+)?)\s*mm$/i;
const WHOLE_AND_FRACTION = /^(\d+)[\s-](\d+)\/(\d+)$/;
const FRACTION_ONLY = /^(\d+)\/(\d+)$/;
const DECIMAL = /^(\d+(?:\.\d+)?)$/;
const TRAILING_INCH_UNIT = /(")\s*$|\s*in\.?\s*$/i;

/**
 * Parses a user-typed length into millimetres. Accepts a bare decimal
 * ("25.5"), a whole plus fraction ("25 1/2", "25-1/2"), a bare fraction
 * ("1/2"), any of those with a trailing inch mark or unit word
 * ("25 1/2\"", "25 1/2 in"), or an explicit millimetre value ("648mm").
 * Everything is inches unless the value ends in "mm".
 */
export function parseLength(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new LengthParseError('Enter a length.');

  const mmMatch = MM_VALUE.exec(trimmed);
  if (mmMatch) return Number(mmMatch[1]);

  const withoutUnit = trimmed.replace(TRAILING_INCH_UNIT, '').trim();

  const wholeFraction = WHOLE_AND_FRACTION.exec(withoutUnit);
  if (wholeFraction) {
    const [, whole, numerator, denominator] = wholeFraction;
    return inchesToMm(Number(whole) + fractionValue(numerator, denominator));
  }

  const fractionOnly = FRACTION_ONLY.exec(withoutUnit);
  if (fractionOnly) {
    const [, numerator, denominator] = fractionOnly;
    return inchesToMm(fractionValue(numerator, denominator));
  }

  const decimal = DECIMAL.exec(withoutUnit);
  if (decimal) return inchesToMm(Number(decimal[1]));

  throw new LengthParseError(`"${input}" isn't a length. Try 25.5, 25 1/2, or 648mm.`);
}

function fractionValue(numerator: string, denominator: string): number {
  const den = Number(denominator);
  if (den === 0) throw new LengthParseError('A fraction cannot have a zero denominator.');
  return Number(numerator) / den;
}

function inchesToMm(inches: number): number {
  return inches * MM_PER_INCH;
}

/**
 * Like `parseLength`, but also rejects zero or negative lengths with a
 * message — for any field a piece's own geometry is built from (a length,
 * width, thickness), where 0 produces a degenerate shape rather than a
 * meaningful one. `parseLength` alone treats "0" as perfectly valid (it
 * is, as a length), so a caller checking the result with a plain
 * truthiness test (`!mm`) silently swallows the error instead of
 * reporting it — found in the final review as a toolbar form that simply
 * refused to submit with no message when a field held "0".
 */
export function parsePositiveLength(input: string): number {
  const mm = parseLength(input);
  if (mm <= 0) throw new LengthParseError('Enter a length greater than zero.');
  return mm;
}

/**
 * Formats a millimetre length for display. `unit: 'mm'` rounds to the
 * nearest 0.1mm ("648.2mm"); `unit: 'in'` reduces to the nearest
 * `denominator` fraction of an inch ("25 1/2\"", "120 5/16\""), the way the
 * shop's own drawings are dimensioned.
 */
export function formatLength(
  mm: number,
  unit: 'in' | 'mm',
  denominator: 16 | 32 = DEFAULT_FRACTION_DENOMINATOR,
): string {
  if (unit === 'mm') return `${roundTo(mm, 1)}mm`;

  const { sign, whole, numerator, denominator: reducedDenominator } = toReducedFraction(mm, denominator);
  if (numerator === 0) return `${sign}${whole}"`;
  return whole > 0
    ? `${sign}${whole} ${numerator}/${reducedDenominator}"`
    : `${sign}${numerator}/${reducedDenominator}"`;
}

/** Splits a millimetre length into whole inches + a reduced fraction at the
 *  given denominator. Shared by formatLength and the DXF exporter, which
 *  needs the same whole/numerator/denominator split to build the SPS-style
 *  stacked-fraction MTEXT (`91{\H1x;\S7/32;}`). */
export function toReducedFraction(
  mm: number,
  denominator: 16 | 32 = DEFAULT_FRACTION_DENOMINATOR,
): { sign: '' | '-'; whole: number; numerator: number; denominator: number } {
  const totalInches = mm / MM_PER_INCH;
  const sign = totalInches < 0 ? '-' : '';
  const abs = Math.abs(totalInches);
  let whole = Math.floor(abs);
  let numerator = Math.round((abs - whole) * denominator);
  let den: number = denominator;
  if (numerator === den) {
    whole += 1;
    numerator = 0;
    den = 1;
  } else if (numerator > 0) {
    const divisor = gcd(numerator, den);
    numerator /= divisor;
    den /= divisor;
  } else {
    den = 1;
  }
  return { sign, whole, numerator, denominator: den };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

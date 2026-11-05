import { describe, expect, it } from 'vitest';
import { decodeDxfBytes, decodeDxfText, decodeMtext } from './dxfText';

describe('decodeMtext', () => {
  it.each([
    // The exact string a real SPS dimension carries (see fixtures/dxf/README.md).
    ['stacked fraction from an SPS dimension', '\\A1;\\A1;91{\\H1x;\\S7/32;}"', ['91 7/32"']],
    ['whole-number dimension', '\\A1;25"', ['25"']],
    ['paragraph break', 'Line one\\PLine two', ['Line one', 'Line two']],
    ['font and colour codes', '{\\fArial|b0|i0;\\C1;Hello}', ['Hello']],
    ['underline and overline toggles', '\\LUnder\\l \\OOver\\o', ['Under Over']],
    ['escaped braces and backslash', 'a\\{b\\}c\\\\d', ['a{b}c\\d']],
    ['non-breaking space', 'a\\~b', ['a b']],
    ['stack with a caret', '\\S1^2;', ['1/2']],
    ['unicode escape', '45\\U+00B0', ['45°']],
    ['plain text', 'Sink', ['Sink']],
  ])('%s', (_name, raw, expected) => {
    expect(decodeMtext(raw)).toEqual(expected);
  });

  it('keeps markup-looking text as plain text', () => {
    expect(decodeMtext('<img src=x onerror=alert(1)>')).toEqual(['<img src=x onerror=alert(1)>']);
  });
});

describe('decodeDxfText', () => {
  it.each([
    ['45%%d', '45°'],
    ['%%c30', '⌀30'],
    ['%%p1/16', '±1/16'],
    ['%%uUnder%%u', 'Under'],
    ['100%%%', '100%'],
    ['W', 'W'],
  ])('%s → %s', (raw, expected) => {
    expect(decodeDxfText(raw)).toBe(expected);
  });
});

describe('decodeDxfBytes', () => {
  const bytes = (...values: number[]) => new Uint8Array(values).buffer;

  it('reads UTF-8', () => {
    expect(decodeDxfBytes(new TextEncoder().encode('45°').buffer as ArrayBuffer)).toBe('45°');
  });

  // R14 files declare $DWGCODEPAGE ansi_1252: a raw 0xB0 is a degree sign,
  // not invalid UTF-8 to be replaced.
  it('falls back to Windows-1252 for bytes that are not valid UTF-8', () => {
    expect(decodeDxfBytes(bytes(0x34, 0x35, 0xb0))).toBe('45°');
  });
});

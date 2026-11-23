import { describe, it, expect } from 'vitest';
import { parsePackingList, MAX_PASTED_SLABS } from './slabPackingList';

describe('parsePackingList — reading rows', () => {
  it.each([
    ['tab-separated (a spreadsheet paste)', '3048\t1524\t30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['space-separated', '3048 1524 30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['comma-separated', '3048,1524,30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['semicolon-separated', '3048;1524;30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['"x" between the sizes', '3048 x 1524 x 30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['a tight "x"', '3048x1524x30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['the multiplication sign', '3048 × 1524', { lengthMm: 3048, widthMm: 1524, thicknessMm: null, lot: '' }],
    ['no thickness', '3048 1524', { lengthMm: 3048, widthMm: 1524, thicknessMm: null, lot: '' }],
    ['a lot after the sizes', '3048 1524 30 B-1234', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: 'B-1234' }],
    ['a lot with no thickness', '3048 1524 B-1234', { lengthMm: 3048, widthMm: 1524, thicknessMm: null, lot: 'B-1234' }],
    ['a lot before the sizes', 'B-1234 3048 1524 30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: 'B-1234' }],
    ['a lot that contains a number', '3048 1524 30 Block 7 East', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: 'Block 7 East' }],
    ['a lot of several words', '3048 1524 Block 7 East', { lengthMm: 3048, widthMm: 1524, thicknessMm: null, lot: 'Block 7 East' }],
    ['decimals', '3048.5 1524.25 30', { lengthMm: 3048.5, widthMm: 1524.25, thicknessMm: 30, lot: '' }],
    ['a decimal comma in a spreadsheet cell', '3048,5\t1524\t30', { lengthMm: 3048.5, widthMm: 1524, thicknessMm: 30, lot: '' }],
    ['surrounding whitespace', '   3048   1524   30   ', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: '' }],
  ])('%s', (_name, line, want) => {
    const { slabs, problems } = parsePackingList(line, 'mm');
    expect(problems).toEqual([]);
    expect(slabs).toEqual([want]);
  });

  it('reads one slab per line, in order, ignoring blank lines and Windows line endings', () => {
    const { slabs, problems } = parsePackingList('3048 1524 30\r\n\r\n3000 1500 30\r\n  \r\n2900 1400 20\r\n', 'mm');
    expect(problems).toEqual([]);
    expect(slabs.map((s) => s.lengthMm)).toEqual([3048, 3000, 2900]);
  });

  it('skips a heading row but only on the first line', () => {
    const { slabs, problems } = parsePackingList('Length\tWidth\tThickness\tBundle\n3048\t1524\t30\tB1', 'mm');
    expect(problems).toEqual([]);
    expect(slabs).toEqual([{ lengthMm: 3048, widthMm: 1524, thicknessMm: 30, lot: 'B1' }]);
  });

  it('gives nothing for empty text', () => {
    expect(parsePackingList('', 'mm')).toEqual({ slabs: [], problems: [] });
    expect(parsePackingList('  \n \t \n', 'mm')).toEqual({ slabs: [], problems: [] });
  });
});

describe('parsePackingList — units', () => {
  it.each([
    ['mm', '3048 1524 30', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30 }],
    ['cm', '304.8 152.4 3', { lengthMm: 3048, widthMm: 1524, thicknessMm: 30 }],
    ['in', '120 60 1.25', { lengthMm: 3048, widthMm: 1524, thicknessMm: 31.75 }],
  ] as const)('converts %s to millimetres', (unit, line, want) => {
    const { slabs } = parsePackingList(line, unit);
    expect(slabs[0]).toMatchObject(want);
  });

  it('rounds to hundredths of a millimetre', () => {
    const { slabs } = parsePackingList('120.123 60 1', 'in');
    expect(slabs[0].lengthMm).toBe(3051.12); // 120.123 in = 3051.1242 mm
  });
});

describe('parsePackingList — rows that cannot be read', () => {
  it.each([
    ['one number', '3048', 'Row 1: needs both a length and a width.'],
    ['four numbers', '1 3048 1524 30', 'Row 1: too many numbers'],
    ['a bare number right against the sizes (a slab or bundle number)', 'Bundle 12 3048 1524 30', 'Row 1: too many numbers'],
    ['a zero length', '0 1524 30', 'Row 1: length and width must be greater than zero.'],
    ['a zero width', '3048 0', 'Row 1: length and width must be greater than zero.'],
    ['a zero thickness', '3048 1524 0', 'Row 1: thickness must be greater than zero.'],
  ])('reports %s', (_name, line, want) => {
    const { slabs, problems } = parsePackingList(line, 'mm');
    expect(slabs).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(want);
  });

  it('names the pasted row, counting blank lines, so it can be found', () => {
    const { slabs, problems } = parsePackingList('3048 1524 30\n\n3000\n2900 1400 20', 'mm');
    expect(slabs).toHaveLength(2);
    expect(problems).toEqual(['Row 3: needs both a length and a width.']);
  });

  it('keeps the good rows when others are bad', () => {
    const { slabs, problems } = parsePackingList('3048 1524 30\nabc def\n3000 1500 30', 'mm');
    expect(slabs.map((s) => s.lengthMm)).toEqual([3048, 3000]);
    expect(problems).toEqual(['Row 2: no length or width found.']);
  });

  it('stops at the row limit and says so', () => {
    const text = Array.from({ length: MAX_PASTED_SLABS + 5 }, () => '3048 1524 30').join('\n');
    const { slabs, problems } = parsePackingList(text, 'mm');
    expect(slabs).toHaveLength(MAX_PASTED_SLABS);
    expect(problems).toEqual([`Only the first ${MAX_PASTED_SLABS} slabs are read; the rest were left out.`]);
  });
});

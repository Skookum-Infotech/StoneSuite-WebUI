import { describe, it, expect } from 'vitest';
import {
  billedPercent, filledSegments, formatQuantity, isOverdue, lineCounts, linePercent,
  progressTone, receivedPercent, showsReceivingProgress, toWholePercent, type LineQuantities,
} from './receivingProgress';

function line(quantity: number, qtyReceived: number, qtyBilled = 0): LineQuantities {
  return { quantity, qtyReceived, qtyBilled };
}

// Every case here has a twin in StoneSuite-Backend purchaseorder/receipt_progress_test.go.
describe('receivedPercent', () => {
  const cases: Array<[string, LineQuantities[], number]> = [
    ['no lines', [], 0],
    ['nothing received', [line(10, 0), line(5, 0)], 0],
    ['one line half received', [line(10, 5)], 50],
    ['fully received', [line(10, 10), line(5, 5)], 100],
    ['lines count equally whatever their quantity', [line(1000, 1000), line(1, 0)], 50],
    ['average of partial lines', [line(10, 10), line(10, 5), line(10, 0)], 50],
    ['over-receipt is capped per line', [line(10, 20), line(10, 0)], 50],
    ['rounds to a whole percent', [line(3, 1)], 33],
    ['rounds half up', [line(8, 1)], 13],
    ['nearly complete never reads 100', [line(1000, 999)], 99],
    ['barely started never reads 0', [line(1000, 1)], 1],
    ['zero-quantity lines ignored', [line(0, 0), line(10, 10)], 100],
    ['only zero-quantity lines', [line(0, 0)], 0],
    ['negative received counts as nothing', [line(10, -4)], 0],
  ];
  it.each(cases)('%s', (_name, lines, want) => {
    expect(receivedPercent(lines)).toBe(want);
  });
});

describe('billedPercent', () => {
  it('averages each line billed ÷ ordered', () => {
    expect(billedPercent([line(10, 10, 10), line(10, 10, 0)])).toBe(50);
  });
  it('is 0 with nothing billed', () => {
    expect(billedPercent([line(10, 10, 0)])).toBe(0);
  });
});

describe('linePercent', () => {
  const cases: Array<[string, number, number, number]> = [
    ['unordered line', 0, 0, 0],
    ['half', 5, 10, 50],
    ['complete', 10, 10, 100],
    ['over-delivery caps at 100', 12, 10, 100],
    ['almost complete is 99', 999, 1000, 99],
  ];
  it.each(cases)('%s', (_name, done, ordered, want) => {
    expect(linePercent(done, ordered)).toBe(want);
  });
});

describe('toWholePercent', () => {
  it.each([[0, 0], [0.004, 1], [0.335, 34], [0.996, 99], [1, 100]])('%s → %s', (fraction, want) => {
    expect(toWholePercent(fraction)).toBe(want);
  });
});

describe('lineCounts', () => {
  it('counts fully received lines out of lines with a quantity', () => {
    expect(lineCounts([line(10, 10), line(10, 4), line(0, 0), line(5, 7)])).toEqual({ received: 2, total: 3 });
  });
  it('is empty with no lines', () => {
    expect(lineCounts([])).toEqual({ received: 0, total: 0 });
  });
});

describe('filledSegments', () => {
  const cases: Array<[number, number]> = [
    [0, 0], [1, 1], [4, 1], [33, 3], [50, 5], [67, 7], [96, 9], [99, 9], [100, 10],
  ];
  it.each(cases)('%s%% lights %s of 10', (percent, want) => {
    expect(filledSegments(percent)).toBe(want);
  });
  it('honours a custom segment count', () => {
    expect(filledSegments(50, 4)).toBe(2);
  });
});

describe('progressTone', () => {
  it.each([[0, 'empty'], [1, 'partial'], [99, 'partial'], [100, 'complete']] as const)('%s → %s', (percent, want) => {
    expect(progressTone(percent)).toBe(want);
  });
});

describe('showsReceivingProgress', () => {
  it.each([
    ['DRFT', false], ['PAPV', false], ['APPV', false], ['CANC', false],
    ['SENT', true], ['PART', true], ['RCVD', true], ['CLSD', true],
  ])('%s → %s', (code, want) => {
    expect(showsReceivingProgress(code)).toBe(want);
  });
});

describe('isOverdue', () => {
  const TODAY = '2026-10-19';
  const cases: Array<[string, { statusCode: string; expectedDate?: string }, number, boolean]> = [
    ['past due and still owed', { statusCode: 'SENT', expectedDate: '2026-10-01' }, 40, true],
    ['partially received and past due', { statusCode: 'PART', expectedDate: '2026-10-18' }, 80, true],
    ['due today is not late yet', { statusCode: 'SENT', expectedDate: TODAY }, 0, false],
    ['not due yet', { statusCode: 'SENT', expectedDate: '2026-11-01' }, 0, false],
    ['fully received', { statusCode: 'PART', expectedDate: '2026-10-01' }, 100, false],
    ['closed short is not late', { statusCode: 'CLSD', expectedDate: '2026-10-01' }, 40, false],
    ['no expected date', { statusCode: 'SENT' }, 0, false],
    ['expected date with a time part', { statusCode: 'SENT', expectedDate: '2026-10-01T00:00:00Z' }, 0, true],
  ];
  it.each(cases)('%s', (_name, order, percent, want) => {
    expect(isOverdue(order, percent, TODAY)).toBe(want);
  });
});

describe('formatQuantity', () => {
  it('drops float noise', () => {
    expect(formatQuantity(0.1 + 0.2)).toBe('0.3');
  });
  it('keeps whole numbers whole', () => {
    expect(formatQuantity(12)).toBe('12');
  });
});

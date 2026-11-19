// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ADD_VIEW_MESSAGES, MAX_SAVED_VIEWS, MAX_VIEW_NAME_LENGTH,
  addView, loadViews, newViewId, removeView, savedViewsKey, storeViews,
  type SavedView,
} from './savedViews';

interface State { q: string }
const isState = (v: unknown): v is State =>
  typeof v === 'object' && v !== null && typeof (v as { q?: unknown }).q === 'string';

const KEY = 'test:views';
const view = (id: string, name = `View ${id}`, q = 'x'): SavedView<State> => ({ id, name, state: { q } });
const many = (n: number) => Array.from({ length: n }, (_, i) => view(`id-${i}`));

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('savedViewsKey', () => {
  it('is different for each page, user and workspace', () => {
    const keys = new Set([
      savedViewsKey('invoices', 'u1', 't1'),
      savedViewsKey('quotes', 'u1', 't1'),
      savedViewsKey('invoices', 'u2', 't1'),
      savedViewsKey('invoices', 'u1', 't2'),
      savedViewsKey('invoices', 'u1', null),
    ]);
    expect(keys.size).toBe(5);
  });
});

describe('loadViews', () => {
  it('is empty when nothing was saved', () => {
    expect(loadViews(KEY, isState)).toEqual([]);
  });

  it('reads back what storeViews wrote, in order', () => {
    const saved = [view('a', 'First', 'one'), view('b', 'Second', 'two')];
    expect(storeViews(KEY, saved)).toBe(true);
    expect(loadViews(KEY, isState)).toEqual(saved);
  });

  it.each([
    ['not JSON', '{oops'],
    ['an empty string', ''],
    ['a JSON object', '{"id":"a"}'],
    ['a JSON string', '"views"'],
    ['null', 'null'],
    ['a number', '42'],
  ])('ignores a corrupt entry that is %s', (_name, raw) => {
    window.localStorage.setItem(KEY, raw);
    expect(loadViews(KEY, isState)).toEqual([]);
  });

  it('drops malformed views and keeps the good ones', () => {
    window.localStorage.setItem(KEY, JSON.stringify([
      view('ok-1'),
      null,
      'a string',
      { id: '', name: 'No id', state: { q: '' } },
      { id: 'no-name', name: '   ', state: { q: '' } },
      { id: 'long', name: 'x'.repeat(MAX_VIEW_NAME_LENGTH + 1), state: { q: '' } },
      { id: 'bad-state', name: 'Bad state', state: { q: 5 } },
      { id: 'no-state', name: 'No state' },
      { id: 7, name: 'Numeric id', state: { q: '' } },
      view('ok-2'),
      view('ok-1', 'Repeated id'),
    ]));
    expect(loadViews(KEY, isState).map((v) => v.id)).toEqual(['ok-1', 'ok-2']);
  });

  it('never returns more than the limit, even if more were stored', () => {
    window.localStorage.setItem(KEY, JSON.stringify(many(MAX_SAVED_VIEWS + 5)));
    expect(loadViews(KEY, isState)).toHaveLength(MAX_SAVED_VIEWS);
  });

  it('is empty, not an error, when the browser will not let the page read storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(loadViews(KEY, isState)).toEqual([]);
  });
});

describe('storeViews', () => {
  it('reports true when stored', () => {
    expect(storeViews(KEY, [view('a')])).toBe(true);
    expect(window.localStorage.getItem(KEY)).toContain('"id":"a"');
  });

  it.each([
    ['storage is full', 'QuotaExceededError'],
    ['storage is blocked', 'SecurityError'],
  ])('reports false instead of throwing when %s', (_name, errorName) => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('no', errorName);
    });
    expect(storeViews(KEY, [view('a')])).toBe(false);
  });
});

describe('addView', () => {
  it('adds a view with the name trimmed and the state as given', () => {
    const result = addView([], '  Open this month  ', { q: 'INV-1' }, 'new-id');
    expect(result).toEqual({
      ok: true,
      view: { id: 'new-id', name: 'Open this month', state: { q: 'INV-1' } },
      views: [{ id: 'new-id', name: 'Open this month', state: { q: 'INV-1' } }],
    });
  });

  it('does not change the list it was given', () => {
    const before = many(2);
    const copy = [...before];
    addView(before, 'Another', { q: '' });
    expect(before).toEqual(copy);
  });

  it.each([
    ['an empty name', '', 'empty'],
    ['a blank name', '   ', 'empty'],
    ['a name over the limit', 'x'.repeat(MAX_VIEW_NAME_LENGTH + 1), 'too-long'],
    ['a name that repeats one, ignoring case', 'view id-0', 'duplicate'],
    ['a name that repeats one, ignoring padding', '  View id-1 ', 'duplicate'],
  ] as const)('refuses %s', (_name, input, error) => {
    expect(addView(many(2), input, { q: '' })).toEqual({ ok: false, error });
  });

  it('accepts a name of exactly the longest length', () => {
    expect(addView([], 'x'.repeat(MAX_VIEW_NAME_LENGTH), { q: '' }).ok).toBe(true);
  });

  it('takes the 20th view but refuses the 21st', () => {
    const nineteen = many(MAX_SAVED_VIEWS - 1);
    const twentieth = addView(nineteen, 'The twentieth', { q: '' });
    expect(twentieth.ok).toBe(true);
    if (!twentieth.ok) return;
    expect(twentieth.views).toHaveLength(MAX_SAVED_VIEWS);
    expect(addView(twentieth.views, 'One too many', { q: '' })).toEqual({ ok: false, error: 'limit' });
  });

  it('has a message for every refusal', () => {
    for (const error of ['empty', 'too-long', 'duplicate', 'limit'] as const) {
      expect(ADD_VIEW_MESSAGES[error]).toMatch(/\S/);
    }
  });
});

describe('removeView', () => {
  it('removes just that view', () => {
    expect(removeView(many(3), 'id-1').map((v) => v.id)).toEqual(['id-0', 'id-2']);
  });

  it('leaves the list alone for an id it does not have', () => {
    expect(removeView(many(2), 'nope')).toHaveLength(2);
  });
});

describe('newViewId', () => {
  it('gives a different id each time', () => {
    expect(new Set(Array.from({ length: 50 }, newViewId)).size).toBe(50);
  });
});
